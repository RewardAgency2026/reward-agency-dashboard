import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { suppliers, supplier_platform_fees, ad_accounts, supplier_payments, clients } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  contact_email: z.string().email().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, params.id))
    .limit(1);
  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [fees, adAccountsList, payments] = await Promise.all([
    db
      .select()
      .from(supplier_platform_fees)
      .where(eq(supplier_platform_fees.supplier_id, params.id)),
    db
      .select({
        id: ad_accounts.id,
        platform: ad_accounts.platform,
        account_id: ad_accounts.account_id,
        account_name: ad_accounts.account_name,
        top_up_fee_rate: ad_accounts.top_up_fee_rate,
        status: ad_accounts.status,
        client_name: clients.name,
        client_code: clients.client_code,
      })
      .from(ad_accounts)
      .leftJoin(clients, eq(ad_accounts.client_id, clients.id))
      .where(eq(ad_accounts.supplier_id, params.id))
      .orderBy(desc(ad_accounts.created_at)),
    db
      .select()
      .from(supplier_payments)
      .where(eq(supplier_payments.supplier_id, params.id))
      .orderBy(desc(supplier_payments.created_at)),
  ]);

  return NextResponse.json({
    ...supplier,
    platform_fees: fees,
    ad_accounts: adAccountsList,
    payments,
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.issues }, { status: 400 });
  }

  const d = parsed.data;
  const updates: Record<string, unknown> = {};
  if (d.name !== undefined) updates.name = d.name;
  if ("contact_email" in d) updates.contact_email = d.contact_email ?? null;
  if (d.status !== undefined) updates.status = d.status;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(suppliers)
    .set(updates)
    .where(eq(suppliers.id, params.id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}
