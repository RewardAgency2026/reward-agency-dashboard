"use client";

import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { ClientTabs } from "@/components/clients/client-tabs";

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 bg-gray-100 rounded w-64" />
      <div className="h-4 bg-gray-100 rounded w-48" />
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-100 rounded w-full" />
        ))}
      </div>
    </div>
  );
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: session } = useSession();
  const canCredit = ["admin", "team"].includes(session?.user.role ?? "");
  const isAdmin = session?.user.role === "admin";

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["clients", id],
    queryFn: () => fetch(`/api/clients/${id}`).then((r) => r.json()),
    enabled: !!id,
    staleTime: 0,
  });

  const { data: topupRequests = [] } = useQuery({
    queryKey: ["topup-requests", { client_id: id }],
    queryFn: () => fetch(`/api/topup-requests?client_id=${id}`).then((r) => r.json()),
    enabled: !!id,
    staleTime: 0,
  });

  const { data: affiliates = [] } = useQuery({
    queryKey: ["affiliates"],
    queryFn: () => fetch("/api/affiliates").then((r) => r.json()),
  });

  const { data: suppliersRaw = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => fetch("/api/suppliers").then((r) => r.json()),
  });

  const { data: adAccountsRaw = [] } = useQuery({
    queryKey: ["ad-accounts", { client_id: id }],
    queryFn: () => fetch(`/api/ad-accounts?client_id=${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  if (clientLoading || !client) {
    return <PageSkeleton />;
  }

  // Build supplier options with nested sub-accounts + fees
  const supplierFeeMap = new Map<string, number>();
  const suppliers = (suppliersRaw as Array<{
    id: string; name: string;
    sub_accounts?: Array<{
      id: string; name: string;
      platform_fees?: Array<{ platform: string; fee_rate: string }>;
    }>;
  }>).map((s) => ({
    id: s.id,
    name: s.name,
    sub_accounts: (s.sub_accounts ?? []).map((sa) => {
      const pfees: Record<string, number> = {};
      for (const f of (sa.platform_fees ?? [])) {
        pfees[f.platform] = parseFloat(f.fee_rate);
        supplierFeeMap.set(`${sa.id}:${f.platform}`, parseFloat(f.fee_rate));
      }
      return { id: sa.id, name: sa.name, platform_fees: pfees };
    }),
  }));

  // Build ad account options for NewRequestModal
  const adAccountOptions = (adAccountsRaw as Array<{
    id: string; platform: string; account_name: string;
    top_up_fee_rate: string; supplier_sub_account_id: string | null; status: string;
  }>).map((a) => ({
    id: a.id,
    client_id: id,
    platform: a.platform,
    account_name: a.account_name,
    top_up_fee_rate: a.top_up_fee_rate,
    supplier_fee_rate: a.supplier_sub_account_id
      ? (String(supplierFeeMap.get(`${a.supplier_sub_account_id}:${a.platform}`) ?? "") || null)
      : null,
    status: a.status,
  }));

  // Merge ad_accounts from client API with full ad account data
  const clientData = {
    ...client,
    ad_accounts: client.ad_accounts ?? [],
  };

  return (
    <ClientTabs
      client={clientData}
      affiliates={affiliates}
      suppliers={suppliers}
      canCredit={canCredit}
      isAdmin={isAdmin}
      topupRequests={topupRequests}
      adAccountOptions={adAccountOptions}
    />
  );
}
