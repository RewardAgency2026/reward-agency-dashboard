"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { TopupRequestsTable } from "@/components/topup-requests/topup-requests-table";
import { NewRequestModal } from "@/components/topup-requests/new-request-modal";

function TableSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} className="animate-pulse">
              {Array.from({ length: 7 }).map((_, j) => (
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

export default function TopupRequestsPage() {
  const { data: session } = useSession();
  const isAdmin = ["admin", "team"].includes(session?.user.role ?? "");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["topup-requests"],
    queryFn: () => fetch("/api/topup-requests").then((r) => r.json()),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetch("/api/clients").then((r) => r.json()),
    enabled: isAdmin,
  });

  const { data: adAccountsRaw = [] } = useQuery({
    queryKey: ["ad-accounts"],
    queryFn: () => fetch("/api/ad-accounts").then((r) => r.json()),
    enabled: isAdmin,
  });

  const { data: suppliersRaw = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => fetch("/api/suppliers").then((r) => r.json()),
    enabled: isAdmin,
  });

  // Build supplier fee map: "subAccountId:platform" -> fee_rate string
  const supplierFeeMap = new Map<string, string>();
  for (const s of suppliersRaw as Array<{
    sub_accounts?: Array<{ id: string; platform_fees?: Array<{ platform: string; fee_rate: string }> }>;
  }>) {
    for (const sa of (s.sub_accounts ?? [])) {
      for (const fee of (sa.platform_fees ?? [])) {
        supplierFeeMap.set(`${sa.id}:${fee.platform}`, fee.fee_rate);
      }
    }
  }

  const clientOptions = (clients as Array<{
    id: string; name: string; client_code: string; balance_model: string;
    wallet_balance: number; billing_currency: string; status: string;
    client_platform_fees: Record<string, number> | null;
    affiliate_id: string | null; affiliate_name: string | null;
    affiliate_code: string | null; affiliate_commission_rate: string | null;
  }>)
    .filter((c) => c.status === "active")
    .map((c) => ({
      id: c.id,
      name: c.name,
      client_code: c.client_code,
      balance_model: c.balance_model,
      wallet_balance: c.wallet_balance,
      billing_currency: c.billing_currency,
      client_platform_fees: c.client_platform_fees,
      affiliate_id: c.affiliate_id,
      affiliate_name: c.affiliate_name,
      affiliate_code: c.affiliate_code,
      commission_rate: c.affiliate_commission_rate,
    }));

  const adAccountOptions = (adAccountsRaw as Array<{
    id: string; client_id: string; platform: string; account_name: string;
    top_up_fee_rate: string; supplier_sub_account_id: string | null; status: string;
  }>).map((a) => ({
    id: a.id,
    client_id: a.client_id,
    platform: a.platform,
    account_name: a.account_name,
    top_up_fee_rate: a.top_up_fee_rate,
    supplier_fee_rate: a.supplier_sub_account_id
      ? (supplierFeeMap.get(`${a.supplier_sub_account_id}:${a.platform}`) ?? null)
      : null,
    status: a.status,
  }));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Top Ups</h1>
        {isAdmin && (
          <NewRequestModal clients={clientOptions} adAccounts={adAccountOptions} label="New Top-Up" />
        )}
      </div>
      {isLoading ? (
        <TableSkeleton />
      ) : (
        <TopupRequestsTable requests={requests ?? []} isAdmin={isAdmin} />
      )}
    </div>
  );
}
