import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { transactions, ad_accounts, clients, supplier_payments } from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "team", "accountant"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const fromIso = from ? new Date(from + "T00:00:00.000Z").toISOString() : null;
  const toIso = to ? new Date(to + "T23:59:59.999Z").toISOString() : null;

  // Get all ad account IDs for this supplier (needed for transaction query)
  const supplierAdAccounts = await db
    .select({ id: ad_accounts.id })
    .from(ad_accounts)
    .where(eq(ad_accounts.supplier_id, params.id));

  const adAccountIds = supplierAdAccounts.map((a) => a.id);

  // Query A: transactions linked to this supplier's ad accounts
  const txnRows = adAccountIds.length > 0
    ? await db
        .select({
          id: transactions.id,
          type: transactions.type,
          amount: transactions.amount,
          currency: transactions.currency,
          description: transactions.description,
          created_at: transactions.created_at,
          ad_account_name: ad_accounts.account_name,
          ad_account_platform: ad_accounts.platform,
          client_name: clients.name,
          client_code: clients.client_code,
        })
        .from(transactions)
        .leftJoin(ad_accounts, eq(transactions.ad_account_id, ad_accounts.id))
        .leftJoin(clients, eq(transactions.client_id, clients.id))
        .where(and(
          inArray(transactions.ad_account_id, adAccountIds),
          sql`${transactions.type} IN ('topup', 'ad_account_withdrawal', 'supplier_fee_refund', 'commission_fee')`,
          ...(fromIso ? [sql`${transactions.created_at} >= ${fromIso}`] : []),
          ...(toIso ? [sql`${transactions.created_at} <= ${toIso}`] : []),
        ))
    : [];

  // Query B: supplier payments
  const paymentConditions = [eq(supplier_payments.supplier_id, params.id)];
  if (fromIso) paymentConditions.push(sql`${supplier_payments.created_at} >= ${fromIso}`);
  if (toIso) paymentConditions.push(sql`${supplier_payments.created_at} <= ${toIso}`);

  const paymentRows = await db
    .select({
      id: supplier_payments.id,
      amount: supplier_payments.amount,
      currency: supplier_payments.currency,
      bank_fees: supplier_payments.bank_fees,
      bank_fees_note: supplier_payments.bank_fees_note,
      payment_method: supplier_payments.payment_method,
      reference: supplier_payments.reference,
      status: supplier_payments.status,
      created_at: supplier_payments.created_at,
    })
    .from(supplier_payments)
    .where(and(...paymentConditions));

  // Unified row type
  type UnifiedRow = {
    id: string;
    type: string;
    amount: string;
    currency: string;
    description: string | null;
    created_at: string;
    ad_account_name: string | null;
    ad_account_platform: string | null;
    client_name: string | null;
    client_code: string | null;
    payment_method: string | null;
    reference: string | null;
    bank_fees: string | null;
    bank_fees_note: string | null;
    status: string | null;
  };

  const unified: UnifiedRow[] = [
    ...txnRows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: r.amount,
      currency: r.currency,
      description: r.description,
      created_at: r.created_at.toISOString(),
      ad_account_name: r.ad_account_name,
      ad_account_platform: r.ad_account_platform,
      client_name: r.client_name,
      client_code: r.client_code,
      payment_method: null,
      reference: null,
      bank_fees: null,
      bank_fees_note: null,
      status: null,
    })),
    ...paymentRows.map((p) => ({
      id: p.id,
      type: "supplier_payment",
      amount: p.amount,
      currency: p.currency,
      description: [
        p.payment_method,
        p.reference ? `Ref: ${p.reference}` : null,
      ].filter(Boolean).join(" — ") || null,
      created_at: p.created_at.toISOString(),
      ad_account_name: null,
      ad_account_platform: null,
      client_name: null,
      client_code: null,
      payment_method: p.payment_method,
      reference: p.reference,
      bank_fees: parseFloat(p.bank_fees) > 0 ? p.bank_fees : null,
      bank_fees_note: p.bank_fees_note,
      status: p.status,
    })),
  ];

  // Sort combined list by date DESC
  unified.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json(unified);
}
