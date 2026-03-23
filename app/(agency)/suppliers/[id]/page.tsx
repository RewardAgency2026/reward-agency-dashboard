import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { suppliers, supplier_platform_fees, ad_accounts, clients, supplier_payments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { SupplierTabs } from "@/components/suppliers/supplier-tabs";

export default async function SupplierDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = ["admin", "team"].includes(session.user.role);

  const [supplierRow] = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      contact_email: suppliers.contact_email,
      status: suppliers.status,
      created_at: suppliers.created_at,
    })
    .from(suppliers)
    .where(eq(suppliers.id, params.id))
    .limit(1);

  if (!supplierRow) notFound();

  const [feeRows, adAccountRows, paymentRows] = await Promise.all([
    db
      .select({
        id: supplier_platform_fees.id,
        platform: supplier_platform_fees.platform,
        fee_rate: supplier_platform_fees.fee_rate,
      })
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
      .where(eq(ad_accounts.supplier_id, params.id)),

    db
      .select({
        id: supplier_payments.id,
        amount: supplier_payments.amount,
        currency: supplier_payments.currency,
        bank_fees: supplier_payments.bank_fees,
        bank_fees_note: supplier_payments.bank_fees_note,
        payment_method: supplier_payments.payment_method,
        reference: supplier_payments.reference,
        status: supplier_payments.status,
        paid_at: supplier_payments.paid_at,
        created_at: supplier_payments.created_at,
      })
      .from(supplier_payments)
      .where(eq(supplier_payments.supplier_id, params.id))
      .orderBy(desc(supplier_payments.created_at)),
  ]);

  const supplierData = {
    ...supplierRow,
    created_at: supplierRow.created_at.toISOString(),
    platform_fees: feeRows,
    ad_accounts: adAccountRows,
    payments: paymentRows.map((p) => ({
      ...p,
      paid_at: p.paid_at?.toISOString() ?? null,
      created_at: p.created_at.toISOString(),
    })),
  };

  return <SupplierTabs supplier={supplierData} isAdmin={isAdmin} />;
}
