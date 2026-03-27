"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ChevronDown, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { EditAffiliateModal } from "./edit-affiliate-modal";
import { PlatformIcon } from "@/components/ui/platform-icon";
import type { AffiliateRow } from "./affiliates-table";

interface AffiliateDetail extends AffiliateRow {
  billing_address: string | null;
  billing_vat: string | null;
  referral_link: string | null;
}

interface ClientRow {
  id: string;
  client_code: string;
  name: string;
  email: string;
  company: string;
  status: string;
  billing_currency: string;
  created_at: string;
}

interface CommissionRow {
  id: string;
  period_year: number;
  period_month: number;
  clients_count: number;
  total_commissions_gross: string;
  total_supplier_fees: string;
  total_profit_net: string;
  commission_rate: string;
  commission_amount: string;
  status: string;
  calculated_at: string;
  approved_at: string | null;
  paid_at: string | null;
  paid_reference: string | null;
}

interface CommissionDetailRow {
  id: string;
  created_at: string;
  amount: string;
  top_up_fee_amount: string;
  supplier_fee_amount: string;
  currency: string;
  client_name: string | null;
  client_code: string | null;
  ad_account_name: string | null;
  ad_account_platform: string | null;
  gross_margin: string;
  commission_due: string;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  inactive: "bg-gray-100 text-gray-500 border border-gray-200",
  paused: "bg-amber-50 text-amber-700 border border-amber-200",
  churned: "bg-red-50 text-red-700 border border-red-200",
};

const COMM_STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  preview:          { label: "In Progress",             badge: "bg-blue-50 text-blue-700 border border-blue-200" },
  pending_approval: { label: "Pending Approval",        badge: "bg-amber-50 text-amber-700 border border-amber-200" },
  approved:         { label: "Approved — Awaiting Payment", badge: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  paid:             { label: "Paid ✓",                  badge: "bg-gray-100 text-gray-600" },
};

function fmt(val: string | null | undefined) {
  const n = parseFloat(val ?? "0");
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

interface Props {
  affiliateId: string;
}

export function AffiliateTabs({ affiliateId }: Props) {
  const [activeTab, setActiveTab] = useState<"clients" | "commissions" | "info">("clients");
  const [showEdit, setShowEdit] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAllDetail, setShowAllDetail] = useState(false);
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [paidReference, setPaidReference] = useState("");
  const queryClient = useQueryClient();

  const { data: affiliate, isLoading: affLoading } = useQuery<AffiliateDetail>({
    queryKey: ["affiliate", affiliateId],
    queryFn: () => fetch(`/api/affiliates/${affiliateId}`).then((r) => r.json()),
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<ClientRow[]>({
    queryKey: ["affiliate-clients", affiliateId],
    queryFn: () => fetch(`/api/affiliates/${affiliateId}/clients`).then((r) => r.json()),
    enabled: activeTab === "clients",
  });

  const { data: commissions = [], isLoading: commLoading } = useQuery<CommissionRow[]>({
    queryKey: ["affiliate-commissions", affiliateId],
    queryFn: () => fetch(`/api/affiliates/${affiliateId}/commissions`).then((r) => r.json()),
    enabled: activeTab === "commissions",
    staleTime: 0,
  });

  const { data: detail = [], isLoading: detailLoading } = useQuery<CommissionDetailRow[]>({
    queryKey: ["commission-detail", expandedId],
    queryFn: () => fetch(`/api/affiliate-commissions/${expandedId}/detail`).then((r) => r.json()),
    enabled: expandedId !== null,
  });

  const pendingApprovalRows = commissions.filter((c) => c.status === "pending_approval");

  function toggleExpand(id: string) {
    setExpandedId(expandedId === id ? null : id);
    if (expandedId !== id) setShowAllDetail(false);
  }

  function invalidateComm() {
    queryClient.invalidateQueries({ queryKey: ["affiliate-commissions", affiliateId] });
    queryClient.invalidateQueries({ queryKey: ["affiliate", affiliateId] });
    queryClient.invalidateQueries({ queryKey: ["pending-commission-count"] });
  }

  const approveMutation = useMutation({
    mutationFn: (commId: string) =>
      fetch(`/api/affiliate-commissions/${commId}/approve`, { method: "POST" }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed");
        return data;
      }),
    onSuccess: invalidateComm,
  });

  const rejectMutation = useMutation({
    mutationFn: (commId: string) =>
      fetch(`/api/affiliate-commissions/${commId}/approve`, { method: "DELETE" }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed");
        return data;
      }),
    onSuccess: invalidateComm,
  });

  const approveAllMutation = useMutation({
    mutationFn: () =>
      fetch("/api/affiliate-commissions/approve-all", { method: "POST" }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed");
        return data;
      }),
    onSuccess: invalidateComm,
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ id, reference }: { id: string; reference: string }) =>
      fetch(`/api/affiliate-commissions/${id}/mark-paid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: reference || undefined }),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed");
        return data;
      }),
    onSuccess: () => {
      invalidateComm();
      setMarkPaidId(null);
      setPaidReference("");
    },
  });

  if (affLoading) return <div className="animate-pulse h-8 bg-gray-100 rounded w-48" />;
  if (!affiliate) return <p className="text-sm text-gray-500">Affiliate not found.</p>;

  return (
    <div>
      {/* Mark Paid modal */}
      {markPaidId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-gray-200 mx-4">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Mark Commission as Paid</h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payment Reference (optional)</label>
                <input
                  value={paidReference}
                  onChange={(e) => setPaidReference(e.target.value)}
                  placeholder="e.g. BANK-REF-12345"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => { setMarkPaidId(null); setPaidReference(""); }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => markPaidMutation.mutate({ id: markPaidId, reference: paidReference })}
                disabled={markPaidMutation.isPending}
                className="rounded-lg bg-[hsl(236,85%,55%)] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] disabled:opacity-50"
              >
                {markPaidMutation.isPending ? "Processing…" : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{affiliate.name}</h1>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", STATUS_BADGE[affiliate.status] ?? "bg-gray-100 text-gray-500")}>
              {affiliate.status}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{affiliate.affiliate_code} · {affiliate.company}</p>
        </div>
        <button
          onClick={() => setShowEdit(true)}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Edit
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Commission Rate</p>
          <p className="text-2xl font-bold text-gray-900">{fmt(affiliate.commission_rate)}%</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Referred Clients</p>
          <p className="text-2xl font-bold text-gray-900">{affiliate.clients_count ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500 mb-1">Total Commissions Paid</p>
          <p className="text-2xl font-bold text-gray-900">${fmt(affiliate.commissions_paid)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-1">
          {(["clients", "commissions", "info"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize transition-colors",
                activeTab === tab
                  ? "border-[hsl(236,85%,55%)] text-[hsl(236,85%,55%)]"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              {tab === "clients" ? `Clients (${clients.length})` : tab === "commissions" ? "Commissions" : "Info"}
              {tab === "commissions" && pendingApprovalRows.length > 0 && activeTab !== "commissions" && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-semibold text-white">
                  {pendingApprovalRows.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Clients tab */}
      {activeTab === "clients" && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {clientsLoading ? (
            <div className="p-8 text-center text-sm text-gray-400 animate-pulse">Loading...</div>
          ) : clients.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No clients referred yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Currency</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Since</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.client_code}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.company}</td>
                    <td className="px-4 py-3 text-gray-600">{c.billing_currency}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", STATUS_BADGE[c.status] ?? "bg-gray-100 text-gray-500")}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Commissions tab */}
      {activeTab === "commissions" && (
        <div className="space-y-4">
          {/* Approve All button */}
          {pendingApprovalRows.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-3">
              <p className="text-sm text-amber-800">
                <strong>{pendingApprovalRows.length}</strong> commission{pendingApprovalRows.length !== 1 ? "s" : ""} pending your approval
              </p>
              <button
                onClick={() => approveAllMutation.mutate()}
                disabled={approveAllMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                <CheckCheck size={14} />
                {approveAllMutation.isPending ? "Approving…" : `Approve All (${pendingApprovalRows.length})`}
              </button>
            </div>
          )}

          {/* Commissions table */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            {commLoading ? (
              <div className="p-8 text-center text-sm text-gray-400 animate-pulse">Loading...</div>
            ) : commissions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">No commission records yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 w-8" />
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Period</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Client Commissions</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Provider Fees</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Gross Margin</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Rate</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Commission Due</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {commissions.map((c) => {
                    const isExpanded = expandedId === c.id;
                    const visibleDetail = showAllDetail ? detail : detail.slice(0, 5);
                    const hiddenCount = detail.length - 5;
                    const cfg = COMM_STATUS_CONFIG[c.status] ?? COMM_STATUS_CONFIG.preview;
                    return (
                      <React.Fragment key={c.id}>
                        <tr className={cn("hover:bg-gray-50/50 cursor-pointer", isExpanded && "bg-blue-50/30")}>
                          <td className="px-3 py-3 text-gray-400" onClick={() => toggleExpand(c.id)}>
                            {isExpanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} />}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap" onClick={() => toggleExpand(c.id)}>
                            {MONTH_NAMES[c.period_month - 1]} {c.period_year}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-700">${fmt(c.total_commissions_gross)}</td>
                          <td className="px-4 py-3 text-right font-mono text-gray-600">−${fmt(c.total_supplier_fees)}</td>
                          <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">${fmt(c.total_profit_net)}</td>
                          <td className="px-4 py-3 text-right font-mono text-gray-600">{fmt(c.commission_rate)}%</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-[hsl(236,85%,55%)]">${fmt(c.commission_amount)}</td>
                          <td className="px-4 py-3">
                            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", cfg.badge)}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {c.status === "pending_approval" && (
                              <span className="inline-flex items-center gap-1.5">
                                <button
                                  onClick={() => approveMutation.mutate(c.id)}
                                  disabled={approveMutation.isPending}
                                  className="text-xs text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-md disabled:opacity-50 transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => rejectMutation.mutate(c.id)}
                                  disabled={rejectMutation.isPending}
                                  className="text-xs text-red-600 border border-red-200 hover:bg-red-50 px-2.5 py-1 rounded-md disabled:opacity-50 transition-colors"
                                >
                                  Reject
                                </button>
                              </span>
                            )}
                            {c.status === "approved" && (
                              <button
                                onClick={() => { setMarkPaidId(c.id); setPaidReference(""); }}
                                className="text-xs text-[hsl(236,85%,55%)] border border-[hsl(236,85%,55%)] hover:bg-[hsl(236,85%,97%)] px-2.5 py-1 rounded-md transition-colors"
                              >
                                Mark Paid
                              </button>
                            )}
                            {c.status === "paid" && c.paid_at && (
                              <span className="text-xs text-gray-400">
                                {new Date(c.paid_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                {c.paid_reference && <span className="block font-mono text-gray-300">{c.paid_reference}</span>}
                              </span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="bg-gray-50/60 px-6 py-4 border-t border-gray-100">
                              {detailLoading ? (
                                <div className="text-sm text-gray-400 animate-pulse py-2">Loading transactions...</div>
                              ) : detail.length === 0 ? (
                                <p className="text-sm text-gray-400 py-2">No top-up transactions found for this period.</p>
                              ) : (
                                <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wide">Date</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wide">Client</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wide">Ad Account</th>
                                        <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wide">Top Up</th>
                                        <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wide">Commission</th>
                                        <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wide">Provider Fee</th>
                                        <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wide">Gross Margin</th>
                                        <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wide">Commission Due</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {visibleDetail.map((row) => (
                                        <tr key={row.id} className="hover:bg-gray-50/50">
                                          <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                                            {new Date(row.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                          </td>
                                          <td className="px-3 py-2">
                                            <p className="font-medium text-gray-800">{row.client_name ?? "—"}</p>
                                            <p className="font-mono text-gray-400">{row.client_code}</p>
                                          </td>
                                          <td className="px-3 py-2">
                                            <div className="flex items-center gap-1.5">
                                              {row.ad_account_platform && <PlatformIcon platform={row.ad_account_platform} size={14} />}
                                              <span className="text-gray-700">{row.ad_account_name ?? "—"}</span>
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono text-gray-700">
                                            {parseFloat(row.amount).toFixed(2)} {row.currency}
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono text-gray-700">
                                            ${parseFloat(row.top_up_fee_amount).toFixed(2)}
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono text-gray-600">
                                            −${parseFloat(row.supplier_fee_amount).toFixed(2)}
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono font-medium text-gray-900">
                                            ${parseFloat(row.gross_margin).toFixed(2)}
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono font-semibold text-[hsl(236,85%,55%)]">
                                            ${parseFloat(row.commission_due).toFixed(2)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {!showAllDetail && hiddenCount > 0 && (
                                    <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50">
                                      <button
                                        onClick={() => setShowAllDetail(true)}
                                        className="text-xs text-[hsl(236,85%,55%)] hover:underline"
                                      >
                                        See {hiddenCount} more
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Info tab */}
      {activeTab === "info" && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-1">Affiliate Code</p>
              <p className="font-mono text-sm font-medium text-gray-900">{affiliate.affiliate_code}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Email</p>
              <p className="text-sm text-gray-900">{affiliate.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Company</p>
              <p className="text-sm text-gray-900">{affiliate.company}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Commission Rate</p>
              <p className="text-sm text-gray-900">{fmt(affiliate.commission_rate)}%</p>
            </div>
            {affiliate.billing_address && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Billing Address</p>
                <p className="text-sm text-gray-900">{affiliate.billing_address}</p>
              </div>
            )}
            {affiliate.billing_vat && (
              <div>
                <p className="text-xs text-gray-500 mb-1">VAT Number</p>
                <p className="text-sm text-gray-900">{affiliate.billing_vat}</p>
              </div>
            )}
            {affiliate.referral_link && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 mb-1">Referral Link</p>
                <p className="text-sm font-mono text-blue-600 break-all">{affiliate.referral_link}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showEdit && affiliate && (
        <EditAffiliateModal
          affiliate={affiliate}
          onClose={() => setShowEdit(false)}
          onUpdated={() => {
            setShowEdit(false);
            queryClient.invalidateQueries({ queryKey: ["affiliate", affiliateId] });
            queryClient.invalidateQueries({ queryKey: ["affiliates"] });
          }}
        />
      )}
    </div>
  );
}
