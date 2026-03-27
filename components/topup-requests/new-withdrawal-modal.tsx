"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdAccount {
  id: string;
  account_name: string;
  account_id: string;
  platform: string;
  client_id: string;
  client_name: string;
  client_code: string;
}

interface WithdrawalResult {
  withdrawal_amount: number;
  commission_refund: number;
  total_credited_to_client: number;
  new_wallet_balance: number;
  ad_account_status: string;
}

interface Props {
  adAccounts: AdAccount[];
  onClose: () => void;
}

const CURRENCIES = ["USD", "USDT", "USDC", "EUR"];

export function NewWithdrawalModal({ adAccounts, onClose }: Props) {
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");
  const [updateStatus, setUpdateStatus] = useState<"" | "disabled" | "deleted">("");
  const [result, setResult] = useState<WithdrawalResult | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ad-accounts/${selectedAccountId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          currency,
          notes: notes || undefined,
          update_status: updateStatus || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Withdrawal failed");
      }
      return res.json() as Promise<WithdrawalResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["topup-requests"] });
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  const selectedAccount = adAccounts.find((a) => a.id === selectedAccountId);

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Withdrawal Processed</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 space-y-2">
              <p className="text-sm font-medium text-emerald-800">Successfully processed</p>
              <div className="grid grid-cols-2 gap-1 text-sm">
                <span className="text-gray-500">Withdrawal Amount</span>
                <span className="font-mono text-right">+${result.withdrawal_amount.toFixed(2)}</span>
                <span className="text-gray-500">Commission Refund</span>
                <span className="font-mono text-right">+${result.commission_refund.toFixed(2)}</span>
                <span className="col-span-2 border-t border-emerald-200 my-1" />
                <span className="font-medium text-gray-700">Total Credited to Wallet</span>
                <span className="font-mono font-semibold text-right text-emerald-700">+${result.total_credited_to_client.toFixed(2)}</span>
                <span className="text-gray-500">New Balance After</span>
                <span className="font-mono font-semibold text-right">${result.new_wallet_balance.toFixed(2)}</span>
              </div>
            </div>
            {result.ad_account_status !== "active" && (
              <p className="text-xs text-gray-500">
                Ad account status updated to <span className="font-medium">{result.ad_account_status}</span>.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-[hsl(236,85%,55%)] text-white text-sm font-medium hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">New Withdrawal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Ad Account selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Ad Account</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)] focus:border-transparent"
            >
              <option value="">Select an ad account…</option>
              {adAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.client_name} — {a.account_name} ({a.platform})
                </option>
              ))}
            </select>
          </div>

          {selectedAccount && (
            <p className="text-xs text-gray-400">
              Client: <span className="font-medium text-gray-600">{selectedAccount.client_name}</span>{" "}
              <span className="font-mono">{selectedAccount.client_code}</span>
            </p>
          )}

          {/* Amount + Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Amount</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Notes (optional)</label>
            <textarea
              rows={2}
              placeholder="Reason for withdrawal…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)] resize-none"
            />
          </div>

          {/* Update status */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Update Ad Account Status (optional)</label>
            <select
              value={updateStatus}
              onChange={(e) => setUpdateStatus(e.target.value as "" | "disabled" | "deleted")}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
            >
              <option value="">Keep current status</option>
              <option value="disabled">Mark as Disabled</option>
              <option value="deleted">Mark as Deleted</option>
            </select>
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!selectedAccountId || !amount || parseFloat(amount) <= 0 || mutation.isPending}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-medium text-white",
              "bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {mutation.isPending ? "Processing…" : "Process Withdrawal"}
          </button>
        </div>
      </div>
    </div>
  );
}
