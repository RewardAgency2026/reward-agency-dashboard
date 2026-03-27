import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { clients, affiliate_commissions, affiliates, transactions } from "@/db/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.userType !== "affiliate") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const affiliateId = session.user.id;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from") ?? todayStr();
  const toParam = searchParams.get("to") ?? todayStr();

  const fromDate = new Date(fromParam + "T00:00:00.000Z");
  const toDate = new Date(toParam + "T23:59:59.999Z");

  // Phase 1: affiliate info + client IDs (needed for period queries)
  const [affiliateRows, affiliateClients] = await Promise.all([
    db
      .select({ commission_rate: affiliates.commission_rate, affiliate_code: affiliates.affiliate_code })
      .from(affiliates)
      .where(eq(affiliates.id, affiliateId))
      .limit(1),
    db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.affiliate_id, affiliateId)),
  ]);

  const affiliateRow = affiliateRows[0];
  const clientIds = affiliateClients.map((c) => c.id);
  const commissionRate = parseFloat(affiliateRow?.commission_rate ?? "0") / 100;

  // Phase 2: all main queries in parallel
  const [
    totalClientsRows,
    activeClientsRows,
    currentCommissionRows,
    totalPaidRows,
    pendingPaymentRows,
    chartRows,
    recentClientRows,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(clients)
      .where(eq(clients.affiliate_id, affiliateId)),

    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(clients)
      .where(and(eq(clients.affiliate_id, affiliateId), eq(clients.status, "active"))),

    db
      .select({ commission_amount: affiliate_commissions.commission_amount })
      .from(affiliate_commissions)
      .where(
        and(
          eq(affiliate_commissions.affiliate_id, affiliateId),
          eq(affiliate_commissions.period_year, currentYear),
          eq(affiliate_commissions.period_month, currentMonth),
          eq(affiliate_commissions.status, "preview")
        )
      )
      .limit(1),

    db
      .select({ total: sql<string>`COALESCE(SUM(commission_amount::numeric), 0)::text` })
      .from(affiliate_commissions)
      .where(and(eq(affiliate_commissions.affiliate_id, affiliateId), eq(affiliate_commissions.status, "paid"))),

    db
      .select({ total: sql<string>`COALESCE(SUM(commission_amount::numeric), 0)::text` })
      .from(affiliate_commissions)
      .where(and(eq(affiliate_commissions.affiliate_id, affiliateId), eq(affiliate_commissions.status, "approved"))),

    db
      .select({
        period_year: affiliate_commissions.period_year,
        period_month: affiliate_commissions.period_month,
        commission_amount: affiliate_commissions.commission_amount,
        status: affiliate_commissions.status,
      })
      .from(affiliate_commissions)
      .where(eq(affiliate_commissions.affiliate_id, affiliateId))
      .orderBy(desc(affiliate_commissions.period_year), desc(affiliate_commissions.period_month))
      .limit(6),

    db
      .select({
        id: clients.id,
        client_code: clients.client_code,
        name: clients.name,
        company: clients.company,
        status: clients.status,
        created_at: clients.created_at,
      })
      .from(clients)
      .where(eq(clients.affiliate_id, affiliateId))
      .orderBy(desc(clients.created_at))
      .limit(5),
  ]);

  // Phase 3: period-specific queries (require clientIds)
  let periodCommission = 0;
  let periodTopupsVolume = 0;
  let periodTopupsCount = 0;
  let dailyData: { date: string; topup_volume: number; commission_earned: number }[] = [];

  if (clientIds.length > 0) {
    const dateCondition = sql`${transactions.created_at} >= ${fromDate.toISOString()} AND ${transactions.created_at} <= ${toDate.toISOString()}`;

    const [periodRows, dailyRows] = await Promise.all([
      db
        .select({
          total_volume: sql<string>`COALESCE(SUM(amount::numeric), 0)::text`,
          total_count: sql<number>`COUNT(*)::int`,
          total_commission: sql<string>`COALESCE(SUM(
            (COALESCE(top_up_fee_amount::numeric, 0) - COALESCE(supplier_fee_amount::numeric, 0))
            * ${commissionRate}
          ), 0)::text`,
        })
        .from(transactions)
        .where(
          and(
            inArray(transactions.client_id, clientIds),
            eq(transactions.type, "topup"),
            dateCondition
          )
        ),
      db
        .select({
          date: sql<string>`DATE(created_at)::text`,
          topup_volume: sql<string>`COALESCE(SUM(amount::numeric), 0)::text`,
          commission_earned: sql<string>`COALESCE(SUM(
            (COALESCE(top_up_fee_amount::numeric, 0) - COALESCE(supplier_fee_amount::numeric, 0))
            * ${commissionRate}
          ), 0)::text`,
        })
        .from(transactions)
        .where(
          and(
            inArray(transactions.client_id, clientIds),
            eq(transactions.type, "topup"),
            dateCondition
          )
        )
        .groupBy(sql`DATE(created_at)`)
        .orderBy(sql`DATE(created_at)`),
    ]);

    periodCommission = parseFloat(periodRows[0]?.total_commission ?? "0");
    periodTopupsVolume = parseFloat(periodRows[0]?.total_volume ?? "0");
    periodTopupsCount = periodRows[0]?.total_count ?? 0;
    dailyData = dailyRows.map((r) => ({
      date: r.date,
      topup_volume: parseFloat(r.topup_volume),
      commission_earned: parseFloat(r.commission_earned),
    }));
  }

  return NextResponse.json(
    {
      affiliate_code: affiliateRow?.affiliate_code ?? "",
      total_clients: totalClientsRows[0]?.count ?? 0,
      active_clients: activeClientsRows[0]?.count ?? 0,
      current_month_commission: parseFloat(currentCommissionRows[0]?.commission_amount ?? "0"),
      total_paid: parseFloat(totalPaidRows[0]?.total ?? "0"),
      pending_payment: parseFloat(pendingPaymentRows[0]?.total ?? "0"),
      monthly_chart: chartRows
        .reverse()
        .map((r) => ({
          period_year: r.period_year,
          period_month: r.period_month,
          commission_amount: parseFloat(r.commission_amount),
          status: r.status,
        })),
      recent_clients: recentClientRows.map((c) => ({
        ...c,
        created_at: c.created_at.toISOString(),
      })),
      period_commission: periodCommission,
      period_topups_volume: periodTopupsVolume,
      period_topups_count: periodTopupsCount,
      daily_data: dailyData,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
