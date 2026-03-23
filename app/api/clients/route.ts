import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { clients, affiliates } from "@/db/schema";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { generateClientCode } from "@/lib/client-code";
import { calculateWalletBalances, balanceFromData } from "@/lib/balance";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  company: z.string().optional().default(""),
  balance_model: z.enum(["classic", "dynamic"]),
  billing_currency: z.enum(["USD", "EUR"]),
  crypto_fee_rate: z.number().min(0).max(100).optional().default(0),
  affiliate_id: z.string().uuid().nullable().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search")?.trim() ?? "";
  const statusFilter = searchParams.get("status") ?? "";
  const modelFilter = searchParams.get("balance_model") ?? "";

  const conditions: ReturnType<typeof eq>[] = [];
  if (search) {
    conditions.push(
      or(
        ilike(clients.name, `%${search}%`),
        ilike(clients.email, `%${search}%`),
        ilike(clients.client_code, `%${search}%`)
      ) as ReturnType<typeof eq>
    );
  }
  if (statusFilter) conditions.push(eq(clients.status, statusFilter) as ReturnType<typeof eq>);
  if (modelFilter) conditions.push(eq(clients.balance_model, modelFilter) as ReturnType<typeof eq>);

  const rows = await db
    .select({
      id: clients.id,
      client_code: clients.client_code,
      name: clients.name,
      email: clients.email,
      company: clients.company,
      status: clients.status,
      balance_model: clients.balance_model,
      billing_currency: clients.billing_currency,
      crypto_fee_rate: clients.crypto_fee_rate,
      affiliate_id: clients.affiliate_id,
      affiliate_name: affiliates.name,
      created_at: clients.created_at,
    })
    .from(clients)
    .leftJoin(affiliates, eq(clients.affiliate_id, affiliates.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(clients.created_at));

  const balanceMap = await calculateWalletBalances(rows.map((r) => r.id));

  const result = rows.map((c) => ({
    ...c,
    wallet_balance: balanceFromData(balanceMap.get(c.id), c.balance_model),
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.issues }, { status: 400 });
  }

  const d = parsed.data;

  // Check for duplicate email before inserting
  const [existing] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.email, d.email))
    .limit(1);

  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 400 });
  }

  const client_code = await generateClientCode();

  const [newClient] = await db
    .insert(clients)
    .values({
      client_code,
      name: d.name,
      email: d.email,
      company: d.company,
      balance_model: d.balance_model,
      billing_currency: d.billing_currency,
      crypto_fee_rate: String(d.crypto_fee_rate),
      affiliate_id: d.affiliate_id ?? null,
    })
    .returning();

  return NextResponse.json(newClient, { status: 201 });
}
