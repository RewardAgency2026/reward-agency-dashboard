import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { clients, affiliate_commissions } from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.userType !== "affiliate") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const affiliateId = session.user.id;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [
    totalClientsRows,
    activeClientsRows,
    currentCommissionRows,
    totalPaidRows,
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
      .where(
        and(
          eq(affiliate_commissions.affiliate_id, affiliateId),
          eq(affiliate_commissions.status, "paid")
        )
      ),

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

  return NextResponse.json(
    {
      total_clients: totalClientsRows[0]?.count ?? 0,
      active_clients: activeClientsRows[0]?.count ?? 0,
      current_month_commission: parseFloat(currentCommissionRows[0]?.commission_amount ?? "0"),
      total_paid: parseFloat(totalPaidRows[0]?.total ?? "0"),
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
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
