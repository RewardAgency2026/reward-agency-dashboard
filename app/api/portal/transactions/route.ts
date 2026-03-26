import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { transactions, ad_accounts } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.userType !== "client") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const clientId = session.user.id;
  const { searchParams } = req.nextUrl;
  const typeFilter = searchParams.get("type") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const conditions = [eq(transactions.client_id, clientId)];
  if (typeFilter) conditions.push(eq(transactions.type, typeFilter));
  if (from) conditions.push(sql`${transactions.created_at} >= ${from}`);
  if (to) conditions.push(sql`${transactions.created_at} < ${to}`);

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
    })
    .from(transactions)
    .leftJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.created_at));

  return NextResponse.json(
    rows.map((r) => ({ ...r, created_at: r.created_at.toISOString() }))
  );
}
