"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { AlertTriangle } from "lucide-react";

interface TopupRow {
  id: string;
  amount: string;
  currency: string;
  status: string;
  notes: string | null;
  created_at: string;
  ad_account_name: string | null;
  ad_account_platform: string | null;
}

interface AdAccountOption {
  id: string;
  platform: string;
  account_name: string;
  status: string;
}

interface DashboardData {
  wallet_balance: number;
  billing_currency: string;
}

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "insufficient_funds", label: "Insufficient Funds" },
  { value: "executed", label: "Executed" },
  { value: "rejected", label: "Rejected" },
] as const;

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  approved: "bg-blue-50 text-blue-700 border border-blue-200",
  insufficient_funds: "bg-red-50 text-red-600 border border-red-200",
  executed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  rejected: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  insufficient_funds: "Insufficient Funds",
  executed: "Executed",
  rejected: "Rejected",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function PortalTopups() {
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [adAccountId, setAdAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USD" | "EUR" | "USDT" | "USDC">("USD");
  const [notes, setNotes] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const queryClient = useQueryClient();

  const { data: topups = [], isLoading } = useQuery<TopupRow[]>({
    queryKey: ["portal-topups", statusFilter],
    queryFn: () => fetch(`/api/portal/topup-requests${statusFilter ? `?status=${statusFilter}` : ""}`).then((r) => r.json()),
  });

  const { data: accounts = [] } = useQuery<AdAccountOption[]>({
    queryKey: ["portal-accounts"],
    queryFn: () => fetch("/api/portal/accounts").then((r) => r.json()),
    enabled: showModal,
  });

  const { data: dashboardData } = useQuery<DashboardData>({
    queryKey: ["portal-dashboard"],
    queryFn: () => fetch("/api/portal/dashboard").then((r) => r.json()),
    enabled: showModal,
  });

  const activeAccounts = accounts.filter((a) => a.status === "active");
  const walletBalance = dashboardData?.wallet_balance ?? 0;
  const parsedAmount = parseFloat(amount) || 0;
  const isInsufficient = parsedAmount > 0 && parsedAmount > walletBalance;

  const createMutation = useMutation({
    mutationFn: (body: { ad_account_id: string; amount: number; currency: string; notes?: string }) =>
      fetch("/api/portal/topup-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed");
        return data;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-topups"] });
      queryClient.invalidateQueries({ queryKey: ["portal-dashboard"] });
      setSubmitSuccess(true);
      setTimeout(() => {
        setShowModal(false);
        setSubmitSuccess(false);
        setAdAccountId("");
        setAmount("");
        setNotes("");
      }, 1500);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adAccountId || parsedAmount <= 0) return;
    createMutation.mutate({
      ad_account_id: adAccountId,
      amount: parsedAmount,
      currency,
      notes: notes || undefined,
    });
  }

  function closeModal() {
    setShowModal(false);
    setAdAccountId("");
    setAmount("");
    setNotes("");
    setSubmitSuccess(false);
    createMutation.reset();
  }

  return (
    <div>
      {/* New Top Up Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-gray-200 mx-4">
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">New Top Up Request</h3>
            </div>

            {submitSuccess ? (
              <div className="px-6 py-8 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 mb-3">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900">Top up request submitted successfully</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="px-6 py-4 space-y-4">
                  {/* Wallet balance */}
                  <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
                    <p className="text-xs text-gray-500 mb-0.5">Current balance</p>
                    <p className={cn("text-lg font-bold", walletBalance > 0 ? "text-emerald-600" : "text-red-500")}>
                      ${walletBalance.toFixed(2)}
                    </p>
                  </div>

                  {/* Ad account select */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ad Account</label>
                    <select
                      value={adAccountId}
                      onChange={(e) => setAdAccountId(e.target.value)}
                      required
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)] focus:border-transparent"
                    >
                      <option value="">Select an ad account...</option>
                      {activeAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.account_name} ({a.platform})
                        </option>
                      ))}
                    </select>
                    {activeAccounts.length === 0 && (
                      <p className="text-xs text-gray-400 mt-1">No active ad accounts available.</p>
                    )}
                  </div>

                  {/* Amount + Currency */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                        placeholder="0.00"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)] focus:border-transparent"
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value as typeof currency)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)] focus:border-transparent"
                      >
                        <option>USD</option>
                        <option>EUR</option>
                        <option>USDT</option>
                        <option>USDC</option>
                      </select>
                    </div>
                  </div>

                  {/* Insufficient balance warning */}
                  {isInsufficient && (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                      <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-xs text-amber-700">
                        Insufficient balance. Please contact your account manager to credit your wallet first.
                      </p>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Any special instructions..."
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)] focus:border-transparent resize-none"
                    />
                  </div>

                  {createMutation.isError && (
                    <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg px-4 py-2 text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || !adAccountId || parsedAmount <= 0}
                    className="rounded-lg px-4 py-2 text-sm font-medium bg-[hsl(236,85%,55%)] text-white hover:bg-[hsl(236,85%,50%)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createMutation.isPending ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="border-b border-gray-200 mb-4">
        <div className="flex gap-1 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                statusFilter === tab.value
                  ? "border-[hsl(236,85%,55%)] text-[hsl(236,85%,55%)]"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400 animate-pulse">Loading...</div>
        ) : topups.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">No top up requests yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Ad Account</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topups.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(t.created_at)}</td>
                  <td className="px-4 py-3">
                    {t.ad_account_name ? (
                      <div className="flex items-center gap-1.5">
                        {t.ad_account_platform && <PlatformIcon platform={t.ad_account_platform} size={16} />}
                        <div>
                          <p className="font-medium text-gray-800">{t.ad_account_name}</p>
                          <p className="text-xs text-gray-400 capitalize">{t.ad_account_platform}</p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono font-medium text-gray-900">{parseFloat(t.amount).toFixed(2)}</span>
                    <span className="ml-1 text-xs text-gray-400">{t.currency}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_BADGE[t.status] ?? "bg-gray-100 text-gray-500")}>
                      {STATUS_LABELS[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{t.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New request button — floating */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg px-4 py-2 text-sm font-medium bg-[hsl(236,85%,55%)] text-white hover:bg-[hsl(236,85%,50%)] transition-colors"
        >
          New Top Up Request
        </button>
      </div>
    </div>
  );
}
