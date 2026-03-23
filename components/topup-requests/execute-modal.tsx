"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface TopupRequest {
  id: string;
  client_name: string | null;
  client_code: string | null;
  ad_account_platform: string | null;
  ad_account_name: string | null;
  supplier_name: string | null;
  sub_account_name: string | null;
  amount: string;
  currency: string;
  top_up_fee_rate: string | null;
  supplier_fee_rate: string | null;
  wallet_balance: number;
  status: string;
}

interface Props {
  request: TopupRequest;
  onSuccess: () => void;
}

export function ExecuteModal({ request, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const amount = parseFloat(request.amount);
  const supplierFeeRate = parseFloat(request.supplier_fee_rate ?? "0");
  const topUpFeeRate = parseFloat(request.top_up_fee_rate ?? "0");
  const supplierFeeAmount = amount * (supplierFeeRate / 100);
  const topUpFeeAmount = amount * (topUpFeeRate / 100);
  const balanceAfter = request.wallet_balance - amount;
  const isForce = request.status === "insufficient_funds";
  const insufficient = request.wallet_balance < amount;

  async function handleExecute() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/topup-requests/${request.id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: isForce }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Execution failed");
      } else {
        setOpen(false);
        onSuccess();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(""); }}
        className={cn(
          "rounded px-2.5 py-1 text-xs font-medium transition-colors",
          isForce
            ? "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100"
            : "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
        )}
      >
        {isForce ? "Execute Anyway" : "Execute"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Confirm Execution</h2>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Summary */}
              <div className="rounded-lg bg-gray-50 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Client</span>
                  <span className="font-medium text-gray-900">{request.client_name} <span className="text-gray-400 font-mono text-xs">({request.client_code})</span></span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Ad Account</span>
                  <span className="font-medium text-gray-900 capitalize">{request.ad_account_platform} — {request.ad_account_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-mono font-semibold text-gray-900">{amount.toFixed(2)} {request.currency}</span>
                </div>
              </div>

              {/* Fee preview */}
              <div className="rounded-lg border border-gray-200 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">
                    Supplier fee ({supplierFeeRate}%)
                    {request.supplier_name && <span className="ml-1 text-gray-400">— {request.supplier_name}{request.sub_account_name ? ` ${request.sub_account_name}` : ""}</span>}
                  </span>
                  <span className="font-mono text-gray-700">{supplierFeeAmount.toFixed(2)} {request.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Your commission ({topUpFeeRate}%)</span>
                  <span className="font-mono text-gray-700">{topUpFeeAmount.toFixed(2)} {request.currency}</span>
                </div>
              </div>

              {/* Balance */}
              <div className="rounded-lg border border-gray-200 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Current balance</span>
                  <span className={cn("font-mono font-medium", insufficient ? "text-red-500" : "text-gray-700")}>
                    {request.wallet_balance.toFixed(2)} {request.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Balance after</span>
                  <span className={cn("font-mono font-semibold", balanceAfter >= 0 ? "text-emerald-600" : "text-red-500")}>
                    {balanceAfter.toFixed(2)} {request.currency}
                  </span>
                </div>
              </div>

              {isForce && (
                <div className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-700">
                  Warning: wallet balance is insufficient. This execution will result in a negative balance.
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </div>

            <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                disabled={loading}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50",
                  isForce
                    ? "bg-orange-500 hover:bg-orange-600"
                    : "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                {loading ? "Executing…" : "Confirm Execute"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
