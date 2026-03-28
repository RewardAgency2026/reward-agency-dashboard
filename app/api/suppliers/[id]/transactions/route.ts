import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { transactions, ad_accounts, clients } from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "team", "accountant"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Get all ad account IDs for this supplier
  const supplierAdAccounts = await db
    .select({ id: ad_accounts.id })
    .from(ad_accounts)
    .where(eq(ad_accounts.supplier_id, params.id));

  const adAccountIds = supplierAdAccounts.map((a) => a.id);
  if (adAccountIds.length === 0) return NextResponse.json([]);

  const conditions = [
    inArray(transactions.ad_account_id, adAccountIds),
    sql`${transactions.type} IN ('topup', 'ad_account_withdrawal', 'supplier_fee_refund', 'commission_fee')`,
  ];

  if (from) {
    conditions.push(sql`${transactions.created_at} >= ${new Date(from + "T00:00:00.000Z").toISOString()}`);
  }
  if (to) {
    conditions.push(sql`${transactions.created_at} <= ${new Date(to + "T23:59:59.999Z").toISOString()}`);
  }

  const rows = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      currency: transactions.currency,
      description: transactions.description,
      created_at: transactions.created_at,
      ad_account_name: ad_accounts.account_name,
      ad_account_platform: ad_accounts.platform,
      client_name: clients.name,
      client_code: clients.client_code,
    })
    .from(transactions)
    .leftJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
    .leftJoin(clients, eq(transactions.client_id, clients.id))
    .where(and(...conditions))
    .orderBy(sql`${transactions.created_at} DESC`);

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      created_at: r.created_at.toISOString(),
    }))
  );
}
