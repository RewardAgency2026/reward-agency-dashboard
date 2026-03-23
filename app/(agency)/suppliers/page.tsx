import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { suppliers, supplier_platform_fees, ad_accounts } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { SuppliersTable } from "@/components/suppliers/suppliers-table";
import { AddSupplierModal } from "@/components/suppliers/add-supplier-modal";

export default async function SuppliersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = ["admin", "team"].includes(session.user.role);

  // Fetch all suppliers
  const supplierRows = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      contact_email: suppliers.contact_email,
      status: suppliers.status,
      created_at: suppliers.created_at,
    })
    .from(suppliers)
    .orderBy(suppliers.name);

  // Batch: platform fees grouped by supplier
  const feeRows = await db
    .select({
      supplier_id: supplier_platform_fees.supplier_id,
      platform: supplier_platform_fees.platform,
      fee_rate: supplier_platform_fees.fee_rate,
    })
    .from(supplier_platform_fees);

  // Batch: ad account counts
  const countRows = await db
    .select({
      supplier_id: ad_accounts.supplier_id,
      count: sql<number>`count(*)::int`,
    })
    .from(ad_accounts)
    .groupBy(ad_accounts.supplier_id);

  // Combine
  const feesBySupplier = new Map<string, { platform: string; fee_rate: string }[]>();
  for (const f of feeRows) {
    if (!feesBySupplier.has(f.supplier_id)) feesBySupplier.set(f.supplier_id, []);
    feesBySupplier.get(f.supplier_id)!.push({ platform: f.platform, fee_rate: f.fee_rate });
  }

  const countBySupplier = new Map<string, number>();
  for (const c of countRows) countBySupplier.set(c.supplier_id, c.count);

  const data = supplierRows.map((s) => ({
    ...s,
    created_at: s.created_at.toISOString(),
    platform_fees: feesBySupplier.get(s.id) ?? [],
    ad_accounts_count: countBySupplier.get(s.id) ?? 0,
  }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
        {isAdmin && <AddSupplierModal />}
      </div>
      <SuppliersTable suppliers={data} isAdmin={isAdmin} />
    </div>
  );
}
