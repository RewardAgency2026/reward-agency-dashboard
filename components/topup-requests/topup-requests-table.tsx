"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ExecuteModal } from "./execute-modal";
import { PlatformIcon } from "@/components/ui/platform-icon";

export interface TopupRequestRow {
  id: string;
  client_id: string;
  ad_account_id: string;
  supplier_id: string | null;
  amount: string;
  currency: string;
  status: string;
  insufficient_funds: boolean;
  notes: string | null;
  executed_by: string | null;
  executed_at: string | null;
  created_at: string;
  client_name: string | null;
  client_code: string | null;
  client_balance_model: string | null;
  ad_account_platform: string | null;
  ad_account_name: string | null;
  top_up_fee_rate: string | null;
  supplier_name: string | null;
  sub_account_name: string | null;
  supplier_fee_rate: string | null;
  affiliate_name: string | null;
  wallet_balance: number;
}

interface Props {
  requests: TopupRequestRow[];
  isAdmin: boolean;
  hideClientColumn?: boolean;
}

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "insufficient_funds", label: "Insufficient Funds" },
  { value: "executed", label: "Executed" },
  { value: "rejected", label: "Rejected" },
] as const;

// Badge and label helpers operate on the composite (status + insufficient_funds) key
function getStatusBadge(status: string, insufficientFunds: boolean): string {
  if (status === "pending" && insufficientFunds) return "bg-red-50 text-red-600 border border-red-200";
  if (status === "pending") return "bg-amber-50 text-amber-700 border border-amber-200";
  if (status === "executed") return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (status === "rejected") return "bg-gray-100 text-gray-500";
  return "bg-gray-100 text-gray-500";
}

function getStatusLabel(status: string, insufficientFunds: boolean): string {
  if (status === "pending" && insufficientFunds) return "Insufficient Funds";
  if (status === "pending") return "Pending";
  if (status === "executed") return "Executed";
  if (status === "rejected") return "Rejected";
  return status;
}


function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function TopupRequestsTable({ requests: initialRequests, isAdmin, hideClientColumn }: Props) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [statusFilter, setStatusFilter] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);

  // Delete modal state
  const [deleteModalId, setDeleteModalId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Sync with server data after background router.refresh()
  React.useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  const pendingCount = requests.filter((r) => r.status === "pending" && !r.insufficient_funds).length;
  const insufficientCount = requests.filter((r) => r.status === "pending" && r.insufficient_funds).length;

  const filtered = statusFilter === "insufficient_funds"
    ? requests.filter((r) => r.status === "pending" && r.insufficient_funds)
    : statusFilter
    ? requests.filter((r) => r.status === statusFilter)
    : requests;

  function handleExecuted(id: string) {
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "executed", executed_at: new Date().toISOString() } : r));
    router.refresh();
  }

  async function handleReject(id: string) {
    setRejectLoading(true);
    try {
      await fetch(`/api/topup-requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setRejectingId(null);
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: "rejected" } : r));
      router.refresh();
    } finally {
      setRejectLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/topup-requests/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteModalId(null);
        setDeleteConfirmText("");
        setRequests((prev) => prev.filter((r) => r.id !== id));
        router.refresh();
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  // Find the request being deleted for modal details
  const deleteTarget = deleteModalId ? requests.find((r) => r.id === deleteModalId) ?? null : null;

  return (
    <div>
      {/* Delete confirmation modal */}
      <div className={deleteModalId ? "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" : "hidden"}>
        <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-gray-200 mx-4">
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Delete Top-Up Request</h3>
            <p className="text-sm text-gray-500 mt-0.5">This action cannot be undone.</p>
          </div>
          {deleteTarget && (
            <div className="px-6 py-4 space-y-3">
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Client</span>
                  <span className="font-medium text-gray-900">{deleteTarget.client_name ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ad Account</span>
                  <span className="font-medium text-gray-900">{deleteTarget.ad_account_name ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-medium text-gray-900">
                    {parseFloat(deleteTarget.amount).toFixed(2)} {deleteTarget.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", getStatusBadge(deleteTarget.status, deleteTarget.insufficient_funds))}>
                    {getStatusLabel(deleteTarget.status, deleteTarget.insufficient_funds)}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type <span className="font-mono font-bold">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono"
                  autoFocus
                />
              </div>
            </div>
          )}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              onClick={() => {
                setDeleteModalId(null);
                setDeleteConfirmText("");
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteModalId && handleDelete(deleteModalId)}
              disabled={deleteConfirmText !== "DELETE" || deleteLoading}
              className="rounded-lg px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteLoading ? "Deleting..." : "Delete Request"}
            </button>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="border-b border-gray-200 mb-4">
        <div className="flex gap-1 overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const count = tab.value === "pending" ? pendingCount
              : tab.value === "insufficient_funds" ? insufficientCount
              : null;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                  statusFilter === tab.value
                    ? "border-[hsl(236,85%,55%)] text-[hsl(236,85%,55%)]"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                )}
              >
                {tab.label}
                {count != null && count > 0 && (
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-xs font-semibold",
                    tab.value === "pending" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No requests found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {!hideClientColumn && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Client</th>
                )}
                {!hideClientColumn && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Affiliate</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Ad Account</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                {isAdmin && (
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => {
                const canAct = isAdmin && r.status === "pending";
                return (
                  <tr key={r.id} className="hover:bg-gray-50/50">
                    {!hideClientColumn && (
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{r.client_name}</p>
                        <p className="text-xs font-mono text-gray-400">{r.client_code}</p>
                      </td>
                    )}
                    {!hideClientColumn && (
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {r.affiliate_name ?? <span className="text-gray-400">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {r.ad_account_platform && <PlatformIcon platform={r.ad_account_platform} size={18} />}
                        <div>
                          <p className="font-medium text-gray-900">{r.ad_account_name}</p>
                          <p className="text-xs text-gray-400 capitalize">{r.ad_account_platform}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{r.supplier_name ?? "—"}</p>
                      {r.sub_account_name && (
                        <p className="text-xs text-gray-400">{r.sub_account_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono font-medium text-gray-900">{parseFloat(r.amount).toFixed(2)}</p>
                      <p className="text-xs text-gray-400">{r.currency}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", getStatusBadge(r.status, r.insufficient_funds))}>
                        {getStatusLabel(r.status, r.insufficient_funds)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(r.created_at)}</td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {canAct && (
                            <>
                              <ExecuteModal request={r} onSuccess={handleExecuted} />
                              {rejectingId === r.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleReject(r.id)}
                                    disabled={rejectLoading}
                                    className="rounded px-2 py-1 text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setRejectingId(null)}
                                    className="rounded px-2 py-1 text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setRejectingId(r.id)}
                                  className="rounded px-2.5 py-1 text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
                                >
                                  Reject
                                </button>
                              )}
                            </>
                          )}
                          {r.status !== "executed" && (
                            <button
                              onClick={() => {
                                setDeleteModalId(r.id);
                                setDeleteConfirmText("");
                              }}
                              className="rounded px-2.5 py-1 text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
