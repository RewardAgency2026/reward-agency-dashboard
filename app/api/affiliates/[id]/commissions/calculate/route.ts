import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { affiliates, clients, transactions, affiliate_commissions } from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { z } from "zod";

const CalculateSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = CalculateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  const { year, month } = parsed.data;

  // Fetch affiliate
  const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.id, params.id)).limit(1);
  if (!affiliate) return NextResponse.json({ error: "Affiliate not found" }, { status: 404 });

  // Get all clients referred by this affiliate
  const affiliateClients = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.affiliate_id, params.id));

  const clientIds = affiliateClients.map((c) => c.id);

  // Date range for the period
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 1);

  let total_commissions_gross = 0;
  let total_supplier_fees = 0;
  let total_topups = 0;

  if (clientIds.length > 0) {
    // commission_fee transactions = top-up fees charged to clients
    const [commFees] = await db
      .select({
        total: sql<string>`COALESCE(SUM(top_up_fee_amount), 0)`,
      })
      .from(transactions)
      .where(
        and(
          inArray(transactions.client_id, clientIds),
          eq(transactions.type, "commission_fee"),
          sql`created_at >= ${periodStart.toISOString()} AND created_at < ${periodEnd.toISOString()}`
        )
      );
    total_commissions_gross = parseFloat(commFees?.total ?? "0");

    // supplier_fee_amount from topup transactions
    const [supFees] = await db
      .select({
        total: sql<string>`COALESCE(SUM(supplier_fee_amount), 0)`,
      })
      .from(transactions)
      .where(
        and(
          inArray(transactions.client_id, clientIds),
          eq(transactions.type, "topup"),
          sql`created_at >= ${periodStart.toISOString()} AND created_at < ${periodEnd.toISOString()}`
        )
      );
    total_supplier_fees = parseFloat(supFees?.total ?? "0");

    // Total topup amounts
    const [topups] = await db
      .select({
        total: sql<string>`COALESCE(SUM(amount), 0)`,
      })
      .from(transactions)
      .where(
        and(
          inArray(transactions.client_id, clientIds),
          eq(transactions.type, "topup"),
          sql`created_at >= ${periodStart.toISOString()} AND created_at < ${periodEnd.toISOString()}`
        )
      );
    total_topups = parseFloat(topups?.total ?? "0");
  }

  const total_profit_net = total_commissions_gross - total_supplier_fees;
  const commission_rate = parseFloat(affiliate.commission_rate);
  const commission_amount = total_profit_net * (commission_rate / 100);

  // Upsert commission record
  const existing = await db
    .select()
    .from(affiliate_commissions)
    .where(
      and(
        eq(affiliate_commissions.affiliate_id, params.id),
        eq(affiliate_commissions.period_year, year),
        eq(affiliate_commissions.period_month, month)
      )
    )
    .limit(1);

  const values = {
    affiliate_id: params.id,
    period_year: year,
    period_month: month,
    clients_count: clientIds.length,
    total_topups: String(total_topups),
    total_commissions_gross: String(total_commissions_gross),
    total_supplier_fees: String(total_supplier_fees),
    total_profit_net: String(total_profit_net),
    commission_rate: String(commission_rate),
    commission_amount: String(commission_amount),
    status: "calculated" as const,
  };

  let record;
  if (existing.length > 0) {
    [record] = await db
      .update(affiliate_commissions)
      .set(values)
      .where(eq(affiliate_commissions.id, existing[0].id))
      .returning();
  } else {
    [record] = await db.insert(affiliate_commissions).values(values).returning();
  }

  return NextResponse.json(record, { status: 201 });
}
