"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlatformIcon } from "@/components/ui/platform-icon";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPeriod(year: number, month: number) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

const STATUS_CONFIG: Record<string, { label: string; badge: string; amountColor: string; message?: string }> = {
  preview: { label: "In Progress", badge: "bg-blue-50 text-blue-700 border border-blue-200", amountColor: "text-blue-600" },
  pending_approval: {
    label: "Pending Approval",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    amountColor: "text-amber-700",
    message: "Your commission is being reviewed. You'll receive an email when it's approved.",
  },
  approved: {
    label: "Approved — Awaiting Payment",
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    amountColor: "text-emerald-600",
  },
  paid: { label: "Paid ✓", badge: "bg-gray-100 text-gray-600 border border-gray-200", amountColor: "text-gray-700" },
};

interface Commission {
  id: string;
  period_year: number;
  period_month: number;
  clients_count: number;
  commission_amount: string;
  total_topups: string;
  status: string;
  paid_at: string | null;
  calculated_at: string | null;
}

interface DetailRow {
  id: string;
  created_at: string;
  top_up_amount: string;
  currency: string;
  client_name: string | null;
  client_code: string | null;
  ad_account_name: string | null;
  ad_account_id: string | null;
  ad_account_platform: string | null;
  gross_margin: string;
  commission_due: string;
}

function CommissionDetail({ commissionId }: { commissionId: string }) {
  const { data: rows = [], isLoading } = useQuery<DetailRow[]>({
    queryKey: ["affiliate-commission-detail", commissionId],
    queryFn: () => fetch(`/api/affiliate/commissions/${commissionId}/detail`).then((r) => r.json()),
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">No top-up records for this period.</p>;
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-gray-50">
          <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wide">Date</th>
          <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wide">Client</th>
          <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wide">Ad Account</th>
          <th className="px-4 py-2 text-right font-medium text-gray-500 uppercase tracking-wide">Top Up Amount</th>
          <th className="px-4 py-2 text-right font-medium text-gray-500 uppercase tracking-wide">Gross Margin</th>
          <th className="px-4 py-2 text-right font-medium text-gray-500 uppercase tracking-wide">Commission Due</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-gray-50/50">
            <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
              {new Date(r.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
            </td>
            <td className="px-4 py-2">
              <p className="font-medium text-gray-800">{r.client_name}</p>
              <p className="font-mono text-gray-400">{r.client_code}</p>
            </td>
            <td className="px-4 py-2">
              <div className="flex items-center gap-1.5">
                {r.ad_account_platform && <PlatformIcon platform={r.ad_account_platform} size={14} />}
                <span className="text-gray-700">{r.ad_account_name}</span>
              </div>
              {r.ad_account_id && (
                <p className="font-mono text-gray-400 mt-0.5">{r.ad_account_id}</p>
              )}
            </td>
            <td className="px-4 py-2 text-right font-mono text-gray-700 whitespace-nowrap">
              {parseFloat(r.top_up_amount).toFixed(2)} {r.currency}
            </td>
            <td className="px-4 py-2 text-right font-mono font-medium text-gray-900">
              ${parseFloat(r.gross_margin).toFixed(2)}
            </td>
            <td className="px-4 py-2 text-right font-mono font-semibold text-[hsl(236,85%,55%)]">
              ${parseFloat(r.commission_due).toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AffiliateCommissionsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: commissions = [], isLoading } = useQuery<Commission[]>({
    queryKey: ["affiliate-commissions"],
    queryFn: () => fetch("/api/affiliate/commissions").then((r) => r.json()),
    staleTime: 0,
  });

  const totalEarned = commissions
    .filter((c) => c.status === "paid")
    .reduce((s, c) => s + parseFloat(c.commission_amount), 0);

  const pending = commissions
    .filter((c) => c.status === "preview" || c.status === "pending_approval" || c.status === "approved")
    .reduce((s, c) => s + parseFloat(c.commission_amount), 0);

  const now = new Date();
  const thisMonth = commissions.find(
    (c) => c.status === "preview" && c.period_year === now.getFullYear() && c.period_month === now.getMonth() + 1
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Commissions</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Earned</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">${fmt(totalEarned)}</p>
          <p className="mt-0.5 text-xs text-gray-400">Paid commissions</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">${fmt(pending)}</p>
          <p className="mt-0.5 text-xs text-gray-400">Awaiting payment</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">This Month</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">
            ${fmt(parseFloat(thisMonth?.commission_amount ?? "0"))}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">In progress</p>
        </div>
      </div>

      {/* Commissions table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-5 py-4 animate-pulse flex gap-4">
                <div className="h-4 bg-gray-100 rounded w-28" />
                <div className="h-4 bg-gray-100 rounded w-16" />
                <div className="h-4 bg-gray-100 rounded w-20 ml-auto" />
              </div>
            ))}
          </div>
        ) : commissions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No commission records yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-6" />
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Period</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Clients</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Commission</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Paid Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {commissions.map((c) => {
                const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.preview;
                const isExpanded = expandedId === c.id;
                return (
                  <>
                    <tr
                      key={c.id}
                      className={cn("hover:bg-gray-50/50 cursor-pointer")}
                      onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    >
                      <td className="px-5 py-3 text-gray-400">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {formatPeriod(c.period_year, c.period_month)}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{c.clients_count}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        {cfg.message && (
                          <p className="mt-1 text-xs text-amber-600 max-w-xs">{cfg.message}</p>
                        )}
                      </td>
                      <td className={`px-5 py-3 text-right font-mono font-semibold ${cfg.amountColor}`}>
                        ${fmt(parseFloat(c.commission_amount))}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">
                        {c.paid_at
                          ? new Date(c.paid_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${c.id}-detail`}>
                        <td colSpan={6} className="bg-gray-50 border-t border-gray-100">
                          <CommissionDetail commissionId={c.id} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
