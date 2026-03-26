import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { clients, ad_accounts, transactions, topup_requests } from "@/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { calculateWalletBalance } from "@/lib/balance";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.userType !== "client") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clientId = session.user.id;

  const [client] = await db
    .select({
      balance_model: clients.balance_model,
      billing_currency: clients.billing_currency,
      client_code: clients.client_code,
      name: clients.name,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const walletBalance = await calculateWalletBalance(clientId, client.balance_model);

  const [countRow] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(ad_accounts)
    .where(and(eq(ad_accounts.client_id, clientId), eq(ad_accounts.status, "active")));

  const recentTransactions = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      currency: transactions.currency,
      description: transactions.description,
      created_at: transactions.created_at,
      ad_account_name: ad_accounts.account_name,
      ad_account_platform: ad_accounts.platform,
    })
    .from(transactions)
    .leftJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
    .where(eq(transactions.client_id, clientId))
    .orderBy(desc(transactions.created_at))
    .limit(5);

  const pendingTopups = await db
    .select({
      id: topup_requests.id,
      amount: topup_requests.amount,
      currency: topup_requests.currency,
      status: topup_requests.status,
      created_at: topup_requests.created_at,
      ad_account_name: ad_accounts.account_name,
      ad_account_platform: ad_accounts.platform,
    })
    .from(topup_requests)
    .leftJoin(ad_accounts, eq(topup_requests.ad_account_id, ad_accounts.id))
    .where(
      and(
        eq(topup_requests.client_id, clientId),
        inArray(topup_requests.status, ["pending", "approved", "insufficient_funds"])
      )
    )
    .orderBy(desc(topup_requests.created_at))
    .limit(3);

  return NextResponse.json({
    wallet_balance: walletBalance,
    balance_model: client.balance_model,
    billing_currency: client.billing_currency,
    client_code: client.client_code,
    name: client.name,
    active_ad_accounts_count: Number(countRow?.count ?? 0),
    recent_transactions: recentTransactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      currency: t.currency,
      description: t.description,
      created_at: t.created_at.toISOString(),
      ad_account_name: t.ad_account_name,
      ad_account_platform: t.ad_account_platform,
    })),
    pending_topups: pendingTopups.map((t) => ({
      id: t.id,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      created_at: t.created_at.toISOString(),
      ad_account_name: t.ad_account_name,
      ad_account_platform: t.ad_account_platform,
    })),
  });
}
