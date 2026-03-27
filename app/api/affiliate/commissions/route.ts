import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { affiliate_commissions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.userType !== "affiliate") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select({
      id: affiliate_commissions.id,
      period_year: affiliate_commissions.period_year,
      period_month: affiliate_commissions.period_month,
      clients_count: affiliate_commissions.clients_count,
      commission_amount: affiliate_commissions.commission_amount,
      total_topups: affiliate_commissions.total_topups,
      status: affiliate_commissions.status,
      paid_at: affiliate_commissions.paid_at,
      calculated_at: affiliate_commissions.calculated_at,
    })
    .from(affiliate_commissions)
    .where(eq(affiliate_commissions.affiliate_id, session.user.id))
    .orderBy(desc(affiliate_commissions.period_year), desc(affiliate_commissions.period_month));

  return NextResponse.json(
    rows.map((r) => ({
      ...r,
      paid_at: r.paid_at?.toISOString() ?? null,
      calculated_at: r.calculated_at?.toISOString() ?? null,
    })),
    { headers: { "Cache-Control": "no-store" } }
  );
}
