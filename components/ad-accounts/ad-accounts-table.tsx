"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { EditAdAccountModal } from "./edit-ad-account-modal";
import { PlatformIcon } from "@/components/ui/platform-icon";

interface SupplierOption {
  id: string;
  name: string;
  sub_accounts: Array<{ id: string; name: string; platform_fees: Record<string, number> }>;
}

interface AdAccount {
  id: string;
  platform: string;
  account_id: string;
  account_name: string;
  top_up_fee_rate: string;
  status: string;
  supplier_id: string;
  supplier_sub_account_id: string | null;
  client_name: string | null;
  client_code: string | null;
  supplier_name: string | null;
  sub_account_name: string | null;
}

interface Props {
  adAccounts: AdAccount[];
  suppliers: SupplierOption[];
  isAdmin: boolean;
}

const PLATFORMS = ["meta", "google", "tiktok", "snapchat", "linkedin"] as const;
const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta", google: "Google", tiktok: "TikTok", snapchat: "Snapchat", linkedin: "LinkedIn",
};
const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  disabled: "bg-red-50 text-red-600 border border-red-200",
  deleted: "bg-red-100 text-red-900 border border-red-300 line-through",
};

export function AdAccountsTable({ adAccounts, suppliers, isAdmin }: Props) {
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return adAccounts.filter((a) => {
      if (q && !a.account_name.toLowerCase().includes(q) && !a.account_id.toLowerCase().includes(q)) return false;
      if (platformFilter !== "all" && a.platform !== platformFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      return true;
    });
  }, [adAccounts, search, platformFilter, statusFilter]);

  const inputCls = "rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]";

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search account name or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={cn(inputCls, "w-64")}
        />
        <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className={inputCls}>
          <option value="all">All Platforms</option>
          {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="deleted">Deleted</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">No ad accounts found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Platform", "Account", "Supplier / Sub-Account", "Client", "Commission Rate", "Status", ...(isAdmin ? ["Actions"] : [])].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <PlatformIcon platform={a.platform} size={18} />
                      <span className="text-sm text-gray-700">{PLATFORM_LABELS[a.platform] ?? a.platform}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{a.account_name}</p>
                    <p className="text-xs font-mono text-gray-400">{a.account_id}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <p className="text-sm">{a.supplier_name ?? "—"}</p>
                    {a.sub_account_name && <p className="text-xs text-gray-400">{a.sub_account_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {a.client_name ?? "—"}
                    {a.client_code && <span className="ml-1 text-xs text-gray-400">({a.client_code})</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">{parseFloat(a.top_up_fee_rate)}%</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_BADGE[a.status] ?? "bg-gray-100 text-gray-600")}>
                      {a.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <EditAdAccountModal adAccount={a} suppliers={suppliers} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
