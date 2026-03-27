"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { X, MinusCircle } from "lucide-react";

interface Props {
  clientId: string;
  walletBalance: number;
  canWithdraw: boolean;
}

type TxnType = "withdraw" | "refund";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function WithdrawModal({ clientId, walletBalance, canWithdraw }: Props) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [type, setType] = useState<TxnType>("withdraw");
  const [description, setDescription] = useState("");

  const num = parseFloat(amount) || 0;
  const remaining = walletBalance - num;
  const insufficient = num > 0 && num > walletBalance;

  function reset() {
    setAmount("");
    setType("withdraw");
    setDescription("");
    setError(null);
    setSuccess(null);
  }

  function handleClose() {
    setOpen(false);
    reset();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!num || num <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    if (insufficient) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/clients/${clientId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num, type, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to process");
        return;
      }
      setSuccess(`${type === "withdraw" ? "Withdrawal" : "Refund"} of ${fmt(num)} USD processed`);
      setTimeout(() => {
        handleClose();
        queryClient.invalidateQueries({ queryKey: ["clients", clientId] });
        queryClient.invalidateQueries({ queryKey: ["clients"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        router.refresh();
      }, 1200);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (!canWithdraw) return null;

  return (
    <>
      <button
        onClick={() => { setOpen(true); reset(); }}
        className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
      >
        <MinusCircle size={14} />
        Withdraw / Refund
      </button>

      <div className={open ? "fixed inset-0 z-50 flex items-center justify-center" : "hidden"}>
        <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
        <div className="relative w-full max-w-md mx-4 bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">Withdraw / Refund</h2>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Available balance */}
            <div className="rounded-md bg-gray-50 border border-gray-200 px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Available balance</span>
              <span className="text-sm font-semibold font-mono text-gray-900">${fmt(walletBalance)} USD</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount (USD)</label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-md border border-gray-200 px-3 py-2 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setAmount(walletBalance.toFixed(2))}
                    className="absolute right-1.5 rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Max
                  </button>
                </div>

                {num > 0 && (
                  <p className={`mt-1.5 text-xs font-medium ${insufficient ? "text-red-600" : "text-gray-500"}`}>
                    {insufficient
                      ? `Insufficient funds — short by $${fmt(num - walletBalance)}`
                      : `Remaining after: $${fmt(remaining)}`}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TxnType)}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="withdraw">Withdraw</option>
                  <option value="refund">Refund</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional note"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {error && (
              <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
            {success && (
              <p className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">{success}</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={handleClose}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || insufficient}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Processing…" : "Confirm"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
