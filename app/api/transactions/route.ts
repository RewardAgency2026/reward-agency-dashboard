import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { transactions, clients, ad_accounts, users } from "@/db/schema";
import { and, desc, eq, gte, ilike, lte, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const typeFilter = searchParams.get("type") ?? "";
  const currencyFilter = searchParams.get("currency") ?? "";
  const clientFilter = searchParams.get("client_id") ?? "";
  const search = searchParams.get("search")?.trim() ?? "";
  const dateFrom = searchParams.get("date_from") ?? "";
  const dateTo = searchParams.get("date_to") ?? "";

  const conditions: ReturnType<typeof eq>[] = [];
  if (typeFilter) conditions.push(eq(transactions.type, typeFilter) as ReturnType<typeof eq>);
  if (currencyFilter) conditions.push(eq(transactions.currency, currencyFilter) as ReturnType<typeof eq>);
  if (clientFilter) conditions.push(eq(transactions.client_id, clientFilter) as ReturnType<typeof eq>);
  if (dateFrom) conditions.push(gte(transactions.created_at, new Date(dateFrom)) as ReturnType<typeof eq>);
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(transactions.created_at, end) as ReturnType<typeof eq>);
  }
  if (search) {
    conditions.push(
      or(
        ilike(clients.name, `%${search}%`),
        ilike(clients.client_code, `%${search}%`),
        ilike(transactions.description, `%${search}%`)
      ) as ReturnType<typeof eq>
    );
  }

  const rows = await db
    .select({
      id: transactions.id,
      client_id: transactions.client_id,
      client_name: clients.name,
      client_code: clients.client_code,
      type: transactions.type,
      amount: transactions.amount,
      currency: transactions.currency,
      is_crypto: transactions.is_crypto,
      crypto_fee_amount: transactions.crypto_fee_amount,
      supplier_fee_amount: transactions.supplier_fee_amount,
      top_up_fee_amount: transactions.top_up_fee_amount,
      description: transactions.description,
      ad_account_name: ad_accounts.account_name,
      ad_account_platform: ad_accounts.platform,
      created_by_name: users.name,
      created_at: transactions.created_at,
    })
    .from(transactions)
    .leftJoin(clients, eq(transactions.client_id, clients.id))
    .leftJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
    .leftJoin(users, eq(transactions.created_by, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(transactions.created_at))
    .limit(500);

  const result = rows.map((r) => ({
    ...r,
    created_at: r.created_at.toISOString(),
  }));

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, max-age=10, stale-while-revalidate=30" },
  });
}
