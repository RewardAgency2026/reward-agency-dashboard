import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { transactions, ad_accounts, clients, suppliers } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      currency: transactions.currency,
      description: transactions.description,
      created_at: transactions.created_at,
      client_id: transactions.client_id,
      ad_account_id: transactions.ad_account_id,
      client_name: clients.name,
      client_code: clients.client_code,
      ad_account_name: ad_accounts.account_name,
      ad_account_platform: ad_accounts.platform,
      supplier_name: suppliers.name,
    })
    .from(transactions)
    .leftJoin(clients, eq(transactions.client_id, clients.id))
    .leftJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
    .leftJoin(suppliers, eq(transactions.supplier_id, suppliers.id))
    .where(eq(transactions.type, "ad_account_withdrawal"))
    .orderBy(desc(transactions.created_at));

  return NextResponse.json(
    rows.map((r) => ({ ...r, created_at: r.created_at.toISOString() })),
    { headers: { "Cache-Control": "no-store" } }
  );
}
