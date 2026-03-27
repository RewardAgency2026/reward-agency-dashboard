import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { topup_requests, clients, ad_accounts, suppliers, supplier_sub_accounts, supplier_platform_fees, affiliates } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { calculateWalletBalance } from "@/lib/balance";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const statusFilter = searchParams.get("status") ?? "";
  const clientFilter = searchParams.get("client_id") ?? "";

  const conditions = [];
  if (statusFilter) conditions.push(eq(topup_requests.status, statusFilter));
  if (clientFilter) conditions.push(eq(topup_requests.client_id, clientFilter));

  const rows = await db
    .select({
      id: topup_requests.id,
      client_id: topup_requests.client_id,
      ad_account_id: topup_requests.ad_account_id,
      amount: topup_requests.amount,
      currency: topup_requests.currency,
      status: topup_requests.status,
      insufficient_funds: topup_requests.insufficient_funds,
      notes: topup_requests.notes,
      executed_by: topup_requests.executed_by,
      executed_at: topup_requests.executed_at,
      created_at: topup_requests.created_at,
      client_name: clients.name,
      client_code: clients.client_code,
      client_balance_model: clients.balance_model,
      client_cached_balance: clients.cached_balance,
      ad_account_platform: ad_accounts.platform,
      ad_account_name: ad_accounts.account_name,
      top_up_fee_rate: ad_accounts.top_up_fee_rate,
      supplier_name: suppliers.name,
      sub_account_name: supplier_sub_accounts.name,
      supplier_fee_rate: supplier_platform_fees.fee_rate,
      affiliate_name: affiliates.name,
    })
    .from(topup_requests)
    .leftJoin(clients, eq(topup_requests.client_id, clients.id))
    .leftJoin(affiliates, eq(clients.affiliate_id, affiliates.id))
    .leftJoin(ad_accounts, eq(topup_requests.ad_account_id, ad_accounts.id))
    .leftJoin(suppliers, eq(ad_accounts.supplier_id, suppliers.id))
    .leftJoin(supplier_sub_accounts, eq(ad_accounts.supplier_sub_account_id, supplier_sub_accounts.id))
    .leftJoin(
      supplier_platform_fees,
      and(
        eq(supplier_platform_fees.supplier_sub_account_id, supplier_sub_accounts.id),
        eq(supplier_platform_fees.platform, ad_accounts.platform)
      )
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(topup_requests.created_at));

  const result = rows.map((r) => {
    const { client_cached_balance, ...rest } = r;
    return {
      ...rest,
      executed_at: r.executed_at?.toISOString() ?? null,
      created_at: r.created_at.toISOString(),
      wallet_balance: parseFloat(client_cached_balance ?? "0"),
    };
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
  });
}

const createSchema = z.object({
  client_id: z.string().uuid("Invalid client ID"),
  ad_account_id: z.string().uuid("Invalid ad account ID"),
  amount: z.number().positive("Amount must be positive"),
  currency: z.enum(["USD", "EUR", "USDT", "USDC"]),
  notes: z.string().nullable().optional(),
});

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

  const { client_id, ad_account_id, amount, currency, notes } = parsed.data;

  // Verify client + ad account in parallel
  const [[client], [adAccount]] = await Promise.all([
    db
      .select({ id: clients.id, balance_model: clients.balance_model })
      .from(clients)
      .where(eq(clients.id, client_id))
      .limit(1),
    db
      .select({ id: ad_accounts.id, supplier_id: ad_accounts.supplier_id, status: ad_accounts.status })
      .from(ad_accounts)
      .where(and(eq(ad_accounts.id, ad_account_id), eq(ad_accounts.client_id, client_id)))
      .limit(1),
  ]);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!adAccount) return NextResponse.json({ error: "Ad account not found for this client" }, { status: 404 });

  if (adAccount.status === "disabled") {
    return NextResponse.json({ error: "This ad account is disabled and cannot receive top ups." }, { status: 400 });
  }
  if (adAccount.status === "deleted") {
    return NextResponse.json({ error: "This ad account has been deleted and cannot receive top ups." }, { status: 400 });
  }

  // Calculate wallet balance to determine insufficient_funds flag
  const wallet_balance = await calculateWalletBalance(client_id, client.balance_model);
  const insufficient_funds = wallet_balance < amount;

  const [newRequest] = await db
    .insert(topup_requests)
    .values({
      client_id,
      ad_account_id,
      amount: String(amount),
      currency,
      status: "pending",
      insufficient_funds,
      notes: notes ?? null,
    })
    .returning();

  return NextResponse.json({ ...newRequest, wallet_balance }, { status: 201 });
}
