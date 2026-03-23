"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlatformFee {
  platform: string;
  fee_rate: string;
}

interface SubAccount {
  id: string;
  name: string;
  status: string;
  platform_fees: PlatformFee[];
}

interface Kpis {
  total_payments_sent: number;
  total_topups: number;
  remaining_balance: number;
  total_ad_accounts: number;
  total_sub_accounts: number;
}

interface Supplier {
  id: string;
  name: string;
  contact_email: string | null;
  status: string;
  created_at: string;
  sub_accounts: SubAccount[];
  kpis: Kpis;
}

interface Props {
  suppliers: Supplier[];
  isAdmin: boolean;
}

const PLATFORM_BADGE: Record<string, string> = {
  meta: "bg-blue-100 text-blue-700",
  google: "bg-red-100 text-red-700",
  tiktok: "bg-gray-900 text-white",
  snapchat: "bg-yellow-100 text-yellow-800",
  pinterest: "bg-rose-100 text-rose-700",
};

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta", google: "Google", tiktok: "TikTok", snapchat: "Snap", pinterest: "Pinterest",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  inactive: "bg-gray-100 text-gray-500",
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Collect all unique platforms with a fee > 0 across all sub-accounts */
function getPlatformBadges(subAccounts: SubAccount[]) {
  const seen = new Set<string>();
  for (const sa of subAccounts) {
    for (const f of sa.platform_fees) {
      if (parseFloat(f.fee_rate) > 0) seen.add(f.platform);
    }
  }
  return [...seen];
}

const PLATFORMS = ["meta", "google", "tiktok", "snapchat", "pinterest"] as const;

export function SuppliersTable({ suppliers, isAdmin }: Props) {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return !q
      ? suppliers
      : suppliers.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.contact_email ?? "").toLowerCase().includes(q)
        );
  }, [suppliers, search]);

  return (
    <div>
      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers…"
            className="w-full rounded-md border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-2 py-3" />
              {["Name", "Sub-Accounts", "Platforms", "Sent", "Remaining", "Ad Accounts", "Status", ""].map((h) => (
                <th key={h} className={cn(
                  "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide",
                  !h && "w-16"
                )}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">
                  No suppliers found.
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const badges = getPlatformBadges(s.sub_accounts);
                const isExpanded = expandedId === s.id;
                return (
                  <React.Fragment key={s.id}>
                    <tr className="hover:bg-gray-50/50">
                      <td className="px-2 py-3">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : s.id)}
                          className="flex items-center justify-center w-6 h-6 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                          aria-label={isExpanded ? "Collapse" : "Expand"}
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          {s.kpis.total_sub_accounts} sub-account{s.kpis.total_sub_accounts !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {badges.map((p) => (
                            <span key={p} className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PLATFORM_BADGE[p])}>
                              {PLATFORM_LABELS[p]}
                            </span>
                          ))}
                          {badges.length === 0 && <span className="text-xs text-gray-400">No fees</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-gray-700">${fmt(s.kpis.total_payments_sent)}</td>
                      <td className={cn("px-4 py-3 font-mono text-sm font-medium", s.kpis.remaining_balance >= 0 ? "text-emerald-600" : "text-red-500")}>
                        ${fmt(s.kpis.remaining_balance)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{s.kpis.total_ad_accounts}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_BADGE[s.status] ?? "bg-gray-100 text-gray-600")}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/suppliers/${s.id}`}
                          className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={9} className="px-0 py-0">
                          <div className="border-t border-gray-200">
                            {s.sub_accounts.length === 0 ? (
                              <p className="px-12 py-4 text-xs text-gray-400">No sub-accounts yet.</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="px-12 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Sub-Account</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Meta</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Google</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">TikTok</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Snapchat</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Pinterest</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {s.sub_accounts.map((sa) => {
                                    const feeMap = Object.fromEntries(
                                      sa.platform_fees.map((f) => [f.platform, parseFloat(f.fee_rate)])
                                    );
                                    return (
                                      <tr key={sa.id} className="hover:bg-gray-100/50">
                                        <td className="px-12 py-2 font-medium text-gray-800">{sa.name}</td>
                                        {PLATFORMS.map((p) => (
                                          <td key={p} className="px-4 py-2 font-mono text-gray-600">
                                            {feeMap[p] > 0 ? `${feeMap[p].toFixed(2)}%` : <span className="text-gray-300">—</span>}
                                          </td>
                                        ))}
                                        <td className="px-4 py-2">
                                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_BADGE[sa.status] ?? "bg-gray-100 text-gray-600")}>
                                            {sa.status}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
