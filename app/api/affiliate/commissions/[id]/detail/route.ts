import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { affiliate_commissions, clients, transactions, ad_accounts } from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.userType !== "affiliate") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Verify ownership
  const [commission] = await db
    .select()
    .from(affiliate_commissions)
    .where(
      and(
        eq(affiliate_commissions.id, params.id),
        eq(affiliate_commissions.affiliate_id, session.user.id)
      )
    )
    .limit(1);

  if (!commission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const affiliateClients = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.affiliate_id, session.user.id));

  const clientIds = affiliateClients.map((c) => c.id);
  if (clientIds.length === 0) return NextResponse.json([]);

  const periodStart = new Date(commission.period_year, commission.period_month - 1, 1);
  const periodEnd = new Date(commission.period_year, commission.period_month, 1);

  const rows = await db
    .select({
      id: transactions.id,
      created_at: transactions.created_at,
      amount: transactions.amount,
      currency: transactions.currency,
      client_name: clients.name,
      client_code: clients.client_code,
      ad_account_name: ad_accounts.account_name,
      ad_account_platform: ad_accounts.platform,
    })
    .from(transactions)
    .leftJoin(clients, eq(transactions.client_id, clients.id))
    .leftJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
    .where(
      and(
        inArray(transactions.client_id, clientIds),
        eq(transactions.type, "topup"),
        sql`${transactions.top_up_fee_amount} > 0`,
        sql`${transactions.created_at} >= ${periodStart.toISOString()} AND ${transactions.created_at} < ${periodEnd.toISOString()}`
      )
    )
    .orderBy(transactions.created_at);

  return NextResponse.json(rows.map((r) => ({ ...r, created_at: r.created_at.toISOString() })));
}
