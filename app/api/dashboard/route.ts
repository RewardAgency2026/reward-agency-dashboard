import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { transactions, clients, ad_accounts, topup_requests, affiliates, users } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    activeClientRows,
    pendingTopups,
    insufficientTopups,
    activeAdAccounts,
    totalAffiliates,
    agencyUsers,
    monthlyTopups,
    monthlyCommissions,
    monthlyProviderFees,
    dailyVolume,
    platformVolume,
    recentTransactions,
  ] = await Promise.all([
    // Active clients count + total cached wallet balance
    db.select({ count: sql<number>`COUNT(*)::int`, total_balance: sql<string>`COALESCE(SUM(cached_balance::numeric), 0)` }).from(clients).where(eq(clients.status, "active")),

    // Pending top ups
    db.select({ count: sql<number>`COUNT(*)::int` }).from(topup_requests).where(eq(topup_requests.status, "pending")),

    // Insufficient funds top ups (pending with flag set)
    db.select({ count: sql<number>`COUNT(*)::int` }).from(topup_requests).where(and(eq(topup_requests.status, "pending"), eq(topup_requests.insufficient_funds, true))),

    // Active ad accounts
    db.select({ count: sql<number>`COUNT(*)::int` }).from(ad_accounts).where(eq(ad_accounts.status, "active")),

    // Total affiliates
    db.select({ count: sql<number>`COUNT(*)::int` }).from(affiliates),

    // Agency users count
    db.select({ count: sql<number>`COUNT(*)::int` }).from(users),

    // Monthly topup volume
    db.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
      .from(transactions)
      .where(and(eq(transactions.type, "topup"), gte(transactions.created_at, monthStart))),

    // Monthly client commissions (commission_fee transactions)
    db.select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
      .from(transactions)
      .where(and(eq(transactions.type, "commission_fee"), gte(transactions.created_at, monthStart))),

    // Monthly provider fees (supplier_fee_amount on topup transactions this month)
    db.select({ total: sql<string>`COALESCE(SUM(supplier_fee_amount::numeric), 0)` })
      .from(transactions)
      .where(and(eq(transactions.type, "topup"), gte(transactions.created_at, monthStart))),

    // Daily volume last 30 days
    db.select({
      date: sql<string>`DATE(created_at)`,
      total: sql<string>`COALESCE(SUM(amount::numeric), 0)`,
    })
      .from(transactions)
      .where(and(eq(transactions.type, "topup"), gte(transactions.created_at, thirtyDaysAgo)))
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at)`),

    // Platform volume this month
    db.select({
      platform: ad_accounts.platform,
      total: sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)`,
    })
      .from(transactions)
      .innerJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
      .where(and(eq(transactions.type, "topup"), gte(transactions.created_at, monthStart)))
      .groupBy(ad_accounts.platform),

    // Recent 10 transactions
    db.select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      currency: transactions.currency,
      description: transactions.description,
      client_name: clients.name,
      client_code: clients.client_code,
      ad_account_platform: ad_accounts.platform,
      created_at: transactions.created_at,
    })
      .from(transactions)
      .leftJoin(clients, eq(transactions.client_id, clients.id))
      .leftJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
      .orderBy(sql`${transactions.created_at} DESC`)
      .limit(10),
  ]);

  const totalWalletBalance = parseFloat(activeClientRows[0]?.total_balance ?? "0");

  const monthlyTopupAmount = parseFloat(monthlyTopups[0]?.total ?? "0");
  const monthlyCommissionAmount = parseFloat(monthlyCommissions[0]?.total ?? "0");
  const monthlyProviderFeeAmount = parseFloat(monthlyProviderFees[0]?.total ?? "0");
  const grossMargin = monthlyCommissionAmount - monthlyProviderFeeAmount;

  return NextResponse.json({
    kpis: {
      total_wallet_balance: totalWalletBalance,
      monthly_topups: monthlyTopupAmount,
      monthly_commissions: monthlyCommissionAmount,
      monthly_provider_fees: monthlyProviderFeeAmount,
      gross_margin: grossMargin,
      active_clients: activeClientRows[0]?.count ?? 0,
      pending_topups: pendingTopups[0]?.count ?? 0,
      insufficient_topups: insufficientTopups[0]?.count ?? 0,
      active_ad_accounts: activeAdAccounts[0]?.count ?? 0,
      total_affiliates: totalAffiliates[0]?.count ?? 0,
      agency_users: agencyUsers[0]?.count ?? 0,
    },
    daily_volume: dailyVolume.map((r) => ({ date: r.date, total: parseFloat(r.total) })),
    platform_volume: platformVolume.map((r) => ({ platform: r.platform, total: parseFloat(r.total) })),
    recent_transactions: recentTransactions.map((r) => ({
      ...r,
      created_at: r.created_at.toISOString(),
    })),
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
