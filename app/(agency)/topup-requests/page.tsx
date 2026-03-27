"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { TopupRequestsTable } from "@/components/topup-requests/topup-requests-table";
import { NewRequestModal } from "@/components/topup-requests/new-request-modal";
import { NewWithdrawalModal } from "@/components/topup-requests/new-withdrawal-modal";

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
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["topup-requests"],
    queryFn: () => fetch("/api/topup-requests").then((r) => r.json()),
    staleTime: 0,
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

  const { data: withdrawals = [] } = useQuery({
    queryKey: ["withdrawals"],
    queryFn: () => fetch("/api/ad-account-withdrawals").then((r) => r.json()),
    staleTime: 0,
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

  const withdrawalAdAccounts = (adAccountsRaw as Array<{
    id: string; account_name: string; account_id: string; platform: string;
    client_id: string; client_name: string | null; client_code: string | null; status: string;
  }>)
    .filter((a) => a.status === "active")
    .map((a) => ({
      id: a.id,
      account_name: a.account_name,
      account_id: a.account_id,
      platform: a.platform,
      client_id: a.client_id,
      client_name: a.client_name ?? "",
      client_code: a.client_code ?? "",
    }));

  return (
    <div>
      {showWithdrawalModal && (
        <NewWithdrawalModal
          adAccounts={withdrawalAdAccounts}
          onClose={() => setShowWithdrawalModal(false)}
        />
      )}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Top Ups &amp; Withdrawals</h1>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowWithdrawalModal(true)}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
            >
              New Withdrawal
            </button>
            <NewRequestModal clients={clientOptions} adAccounts={adAccountOptions} label="New Top-Up" />
          </div>
        )}
      </div>
      {isLoading ? (
        <TableSkeleton />
      ) : (
        <TopupRequestsTable requests={requests ?? []} isAdmin={isAdmin} withdrawals={withdrawals} />
      )}
    </div>
  );
}
