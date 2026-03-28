import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { clients, affiliates, transactions, ad_accounts, users } from "@/db/schema";
import { eq, desc, and, ne } from "drizzle-orm";
import { z } from "zod";
import { calculateWalletBalance } from "@/lib/balance";
import { logAudit } from "@/lib/audit";

const platformFeesSchema = z.object({
  meta: z.number().min(0).max(100).default(0),
  google: z.number().min(0).max(100).default(0),
  tiktok: z.number().min(0).max(100).default(0),
  snapchat: z.number().min(0).max(100).default(0),
  linkedin: z.number().min(0).max(100).default(0),
});

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  company: z.string().optional(),
  status: z.enum(["active", "paused", "churned"]).optional(),
  crypto_fee_rate: z.number().min(0).max(100).optional(),
  billing_currency: z.enum(["USD", "EUR"]).optional(),
  affiliate_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  has_setup: z.boolean().optional(),
  setup_monthly_fee: z.number().min(0).nullable().optional(),
  setup_monthly_cost: z.number().min(0).nullable().optional(),
  client_platform_fees: platformFeesSchema.nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [client] = await db
    .select({
      id: clients.id,
      client_code: clients.client_code,
      name: clients.name,
      email: clients.email,
      company: clients.company,
      status: clients.status,
      balance_model: clients.balance_model,
      billing_currency: clients.billing_currency,
      crypto_fee_rate: clients.crypto_fee_rate,
      affiliate_id: clients.affiliate_id,
      affiliate_name: affiliates.name,
      affiliate_code: affiliates.affiliate_code,
      onboarding_source: clients.onboarding_source,
      notes: clients.notes,
      has_setup: clients.has_setup,
      setup_monthly_fee: clients.setup_monthly_fee,
      setup_monthly_cost: clients.setup_monthly_cost,
      client_platform_fees: clients.client_platform_fees,
      created_at: clients.created_at,
    })
    .from(clients)
    .leftJoin(affiliates, eq(clients.affiliate_id, affiliates.id))
    .where(eq(clients.id, params.id))
    .limit(1);

  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const wallet_balance = await calculateWalletBalance(client.id, client.balance_model);

  // All transactions — never expose supplier/topup fee columns
  const recentTxns = await db
    .select({
      id: transactions.id,
      type: transactions.type,
      amount: transactions.amount,
      currency: transactions.currency,
      is_crypto: transactions.is_crypto,
      description: transactions.description,
      spend_date: transactions.spend_date,
      created_at: transactions.created_at,
      created_by_name: users.name,
    })
    .from(transactions)
    .leftJoin(users, eq(transactions.created_by, users.id))
    .where(and(eq(transactions.client_id, params.id), ne(transactions.type, "supplier_fee_refund")))
    .orderBy(desc(transactions.created_at));

  // Ad accounts list
  const adAccountsList = await db
    .select({
      id: ad_accounts.id,
      platform: ad_accounts.platform,
      account_id: ad_accounts.account_id,
      account_name: ad_accounts.account_name,
      status: ad_accounts.status,
    })
    .from(ad_accounts)
    .where(eq(ad_accounts.client_id, params.id))
    .orderBy(desc(ad_accounts.created_at));

  return NextResponse.json({
    ...client,
    wallet_balance,
    transactions: recentTxns,
    ad_accounts: adAccountsList,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Reject any attempt to change balance_model
  if (body && typeof body === "object" && "balance_model" in body) {
    return NextResponse.json(
      { error: "balance_model cannot be changed after creation" },
      { status: 400 }
    );
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.issues }, { status: 400 });
  }

  const d = parsed.data;
  const updates: Record<string, unknown> = {};
  if (d.name !== undefined) updates.name = d.name;
  if (d.company !== undefined) updates.company = d.company;
  if (d.status !== undefined) updates.status = d.status;
  if (d.crypto_fee_rate !== undefined) updates.crypto_fee_rate = String(d.crypto_fee_rate);
  if (d.billing_currency !== undefined) updates.billing_currency = d.billing_currency;
  if ("affiliate_id" in d) updates.affiliate_id = d.affiliate_id ?? null;
  if ("notes" in d) updates.notes = d.notes ?? null;
  if (d.has_setup !== undefined) updates.has_setup = d.has_setup;
  if ("setup_monthly_fee" in d) updates.setup_monthly_fee = d.setup_monthly_fee != null ? String(d.setup_monthly_fee) : null;
  if ("setup_monthly_cost" in d) updates.setup_monthly_cost = d.setup_monthly_cost != null ? String(d.setup_monthly_cost) : null;
  if ("client_platform_fees" in d) updates.client_platform_fees = d.client_platform_fees ?? null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(clients)
    .set(updates)
    .where(eq(clients.id, params.id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  logAudit({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "Unknown",
    action: "client_updated",
    details: {
      client_name: updated.name,
      client_code: updated.client_code,
    },
  });

  return NextResponse.json(updated);
}
