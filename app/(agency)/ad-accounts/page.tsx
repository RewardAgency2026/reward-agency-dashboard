"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { AdAccountsTable } from "@/components/ad-accounts/ad-accounts-table";
import { AddAdAccountModal } from "@/components/ad-accounts/add-ad-account-modal";

function TableSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} className="animate-pulse">
              {Array.from({ length: 6 }).map((_, j) => (
                <td key={j} className="px-4 py-3">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdAccountsPage() {
  const { data: session } = useSession();
  const isAdmin = ["admin", "team"].includes(session?.user.role ?? "");

  const { data: adAccounts, isLoading } = useQuery({
    queryKey: ["ad-accounts"],
    queryFn: () => fetch("/api/ad-accounts").then((r) => r.json()),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetch("/api/clients").then((r) => r.json()),
  });

  const { data: suppliersRaw = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => fetch("/api/suppliers").then((r) => r.json()),
  });

  const supplierOptions = (suppliersRaw as Array<{
    id: string; name: string;
    sub_accounts?: Array<{ id: string; name: string; platform_fees?: Array<{ platform: string; fee_rate: string }> }>;
  }>).map((s) => ({
    id: s.id,
    name: s.name,
    sub_accounts: (s.sub_accounts ?? []).map((sa) => ({
      id: sa.id,
      name: sa.name,
      platform_fees: Object.fromEntries(
        (sa.platform_fees ?? []).map((f) => [f.platform, parseFloat(f.fee_rate)])
      ),
    })),
  }));

  const clientOptions = (clients as Array<{
    id: string; name: string; client_code: string; client_platform_fees?: Record<string, number> | null;
  }>).map((c) => ({
    id: c.id,
    name: c.name,
    client_code: c.client_code,
    client_platform_fees: c.client_platform_fees ?? null,
  }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Ad Accounts</h1>
        {isAdmin && (
          <AddAdAccountModal clients={clientOptions} suppliers={supplierOptions} />
        )}
      </div>
      {isLoading ? (
        <TableSkeleton />
      ) : (
        <AdAccountsTable
          adAccounts={(adAccounts ?? []).map((a: {
            id: string; platform: string; account_id: string; account_name: string;
            top_up_fee_rate: string; status: string; supplier_id: string;
            supplier_sub_account_id: string | null;
            client_name: string | null; client_code: string | null;
            supplier_name: string | null; sub_account_name: string | null;
          }) => ({
            ...a,
            client_name: a.client_name ?? null,
            client_code: a.client_code ?? null,
            supplier_name: a.supplier_name ?? null,
            sub_account_name: a.sub_account_name ?? null,
          }))}
          suppliers={supplierOptions}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
