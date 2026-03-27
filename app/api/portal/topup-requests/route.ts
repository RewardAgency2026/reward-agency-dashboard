import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { topup_requests, ad_accounts, clients } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { calculateWalletBalance } from "@/lib/balance";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.userType !== "client") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clientId = session.user.id;
  const { searchParams } = req.nextUrl;
  const statusFilter = searchParams.get("status") ?? "";

  const conditions = [eq(topup_requests.client_id, clientId)];
  if (statusFilter) conditions.push(eq(topup_requests.status, statusFilter));

  const rows = await db
    .select({
      id: topup_requests.id,
      amount: topup_requests.amount,
      currency: topup_requests.currency,
      status: topup_requests.status,
      insufficient_funds: topup_requests.insufficient_funds,
      notes: topup_requests.notes,
      created_at: topup_requests.created_at,
      ad_account_name: ad_accounts.account_name,
      ad_account_platform: ad_accounts.platform,
    })
    .from(topup_requests)
    .leftJoin(ad_accounts, eq(topup_requests.ad_account_id, ad_accounts.id))
    .where(and(...conditions))
    .orderBy(desc(topup_requests.created_at));

  return NextResponse.json(
    rows.map((r) => ({ ...r, created_at: r.created_at.toISOString() }))
  );
}

const createSchema = z.object({
  ad_account_id: z.string().uuid("Invalid ad account ID"),
  amount: z.number().positive("Amount must be positive"),
  currency: z.enum(["USD", "EUR", "USDT", "USDC"]),
  notes: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.userType !== "client") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clientId = session.user.id;

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

  const { ad_account_id, amount, currency, notes } = parsed.data;

  // Verify ad account belongs to this client
  const [adAccount] = await db
    .select({ id: ad_accounts.id, supplier_id: ad_accounts.supplier_id, status: ad_accounts.status })
    .from(ad_accounts)
    .where(and(eq(ad_accounts.id, ad_account_id), eq(ad_accounts.client_id, clientId)))
    .limit(1);

  if (!adAccount) return NextResponse.json({ error: "Ad account not found" }, { status: 404 });
  if (adAccount.status === "disabled") return NextResponse.json({ error: "This ad account is disabled" }, { status: 400 });
  if (adAccount.status === "deleted") return NextResponse.json({ error: "This ad account has been deleted" }, { status: 400 });

  const [client] = await db
    .select({ balance_model: clients.balance_model })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const walletBalance = await calculateWalletBalance(clientId, client.balance_model);
  const insufficient_funds = walletBalance < amount;

  const [newRequest] = await db
    .insert(topup_requests)
    .values({
      client_id: clientId,
      ad_account_id,
      amount: String(amount),
      currency,
      status: "pending",
      insufficient_funds,
      notes: notes ?? null,
    })
    .returning();

  return NextResponse.json({ ...newRequest, wallet_balance: walletBalance }, { status: 201 });
}
