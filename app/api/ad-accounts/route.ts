import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { ad_accounts, clients, suppliers, supplier_sub_accounts } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

const createSchema = z.object({
  client_id: z.string().uuid("Invalid client ID"),
  supplier_sub_account_id: z.string().uuid("Invalid supplier sub-account ID"),
  platform: z.enum(["meta", "google", "tiktok", "snapchat", "linkedin"]),
  account_id: z.string().min(1, "Account ID is required"),
  account_name: z.string().min(1, "Account name is required"),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const clientFilter = searchParams.get("client_id") ?? "";
  const supplierFilter = searchParams.get("supplier_id") ?? "";
  const platformFilter = searchParams.get("platform") ?? "";
  const statusFilter = searchParams.get("status") ?? "";

  const conditions: ReturnType<typeof eq>[] = [];
  if (clientFilter) conditions.push(eq(ad_accounts.client_id, clientFilter) as ReturnType<typeof eq>);
  if (supplierFilter) conditions.push(eq(ad_accounts.supplier_id, supplierFilter) as ReturnType<typeof eq>);
  if (platformFilter) conditions.push(eq(ad_accounts.platform, platformFilter) as ReturnType<typeof eq>);
  if (statusFilter) conditions.push(eq(ad_accounts.status, statusFilter) as ReturnType<typeof eq>);

  const rows = await db
    .select({
      id: ad_accounts.id,
      platform: ad_accounts.platform,
      account_id: ad_accounts.account_id,
      account_name: ad_accounts.account_name,
      top_up_fee_rate: ad_accounts.top_up_fee_rate,
      status: ad_accounts.status,
      created_at: ad_accounts.created_at,
      client_id: ad_accounts.client_id,
      client_name: clients.name,
      client_code: clients.client_code,
      supplier_id: ad_accounts.supplier_id,
      supplier_name: suppliers.name,
      supplier_sub_account_id: ad_accounts.supplier_sub_account_id,
      sub_account_name: supplier_sub_accounts.name,
    })
    .from(ad_accounts)
    .leftJoin(clients, eq(ad_accounts.client_id, clients.id))
    .leftJoin(suppliers, eq(ad_accounts.supplier_id, suppliers.id))
    .leftJoin(supplier_sub_accounts, eq(ad_accounts.supplier_sub_account_id, supplier_sub_accounts.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(ad_accounts.created_at));

  return NextResponse.json(rows, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
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

  // Fetch client + sub-account in parallel
  const [[client], [subAccount]] = await Promise.all([
    db
      .select({ id: clients.id, client_platform_fees: clients.client_platform_fees })
      .from(clients)
      .where(eq(clients.id, d.client_id))
      .limit(1),
    db
      .select({ id: supplier_sub_accounts.id, supplier_id: supplier_sub_accounts.supplier_id })
      .from(supplier_sub_accounts)
      .where(eq(supplier_sub_accounts.id, d.supplier_sub_account_id))
      .limit(1),
  ]);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!subAccount) return NextResponse.json({ error: "Supplier sub-account not found" }, { status: 404 });

  const platformFees = client.client_platform_fees as Record<string, number> | null;
  const top_up_fee_rate = platformFees?.[d.platform] ?? 0;

  const [newAccount] = await db
    .insert(ad_accounts)
    .values({
      client_id: d.client_id,
      supplier_id: subAccount.supplier_id,
      supplier_sub_account_id: d.supplier_sub_account_id,
      platform: d.platform,
      account_id: d.account_id,
      account_name: d.account_name,
      top_up_fee_rate: String(top_up_fee_rate),
    })
    .returning();

  return NextResponse.json(newAccount, { status: 201 });
}
