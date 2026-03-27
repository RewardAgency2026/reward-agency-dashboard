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

  // Verify ownership and get commission_rate for computing commission_due
  const [commission] = await db
    .select({
      id: affiliate_commissions.id,
      affiliate_id: affiliate_commissions.affiliate_id,
      period_year: affiliate_commissions.period_year,
      period_month: affiliate_commissions.period_month,
      commission_rate: affiliate_commissions.commission_rate,
    })
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
      top_up_amount: transactions.amount,
      currency: transactions.currency,
      client_name: clients.name,
      client_code: clients.client_code,
      ad_account_name: ad_accounts.account_name,
      ad_account_id: ad_accounts.account_id,
      ad_account_platform: ad_accounts.platform,
      // Compute gross_margin server-side; never expose individual fee amounts
      top_up_fee_amount: transactions.top_up_fee_amount,
      supplier_fee_amount: transactions.supplier_fee_amount,
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

  const commissionRate = parseFloat(commission.commission_rate) / 100;

  return NextResponse.json(
    rows.map((r) => {
      const gross_margin =
        parseFloat(r.top_up_fee_amount) - parseFloat(r.supplier_fee_amount ?? "0");
      const commission_due = gross_margin * commissionRate;
      return {
        id: r.id,
        created_at: r.created_at.toISOString(),
        top_up_amount: r.top_up_amount,
        currency: r.currency,
        client_name: r.client_name,
        client_code: r.client_code,
        ad_account_name: r.ad_account_name,
        ad_account_id: r.ad_account_id,
        ad_account_platform: r.ad_account_platform,
        gross_margin: gross_margin.toFixed(2),
        commission_due: commission_due.toFixed(2),
      };
    })
  );
}
