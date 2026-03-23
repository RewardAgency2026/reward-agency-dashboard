"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, DollarSign } from "lucide-react";

interface Props {
  clientId: string;
  cryptoFeeRate: number;
  canCredit: boolean;
}

type Currency = "USD" | "USDT" | "USDC" | "EUR";
const CRYPTO_CURRENCIES = new Set<Currency>(["USDT", "USDC"]);

export function CreditModal({ clientId, cryptoFeeRate, canCredit }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [description, setDescription] = useState("");

  const grossAmount = parseFloat(amount) || 0;
  const isCrypto = CRYPTO_CURRENCIES.has(currency);
  const fee = isCrypto ? Math.round(grossAmount * (cryptoFeeRate / 100) * 100) / 100 : 0;
  const net = isCrypto ? Math.round((grossAmount - fee) * 100) / 100 : grossAmount;

  function reset() {
    setAmount("");
    setCurrency("USD");
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
    if (!grossAmount || grossAmount <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/clients/${clientId}/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: grossAmount, currency, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to credit wallet");
        return;
      }
      setSuccess(`Wallet credited: ${net.toFixed(2)} ${currency}`);
      setTimeout(() => {
        handleClose();
        router.refresh();
      }, 1200);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (!canCredit) return null;

  return (
    <>
      <button
        onClick={() => { setOpen(true); reset(); }}
        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
      >
        <DollarSign size={14} />
        Credit Balance
      </button>

      <div className={open ? "fixed inset-0 z-50 flex items-center justify-center" : "hidden"}>
        <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
        <div className="relative w-full max-w-md mx-4 bg-white rounded-lg shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-900">Credit Balance</h2>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="USDT">USDT</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional note"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {isCrypto && grossAmount > 0 && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm">
                <p className="font-medium text-amber-800">Crypto fee preview</p>
                <p className="text-amber-700 mt-1">
                  Fee ({cryptoFeeRate}%): <span className="font-mono">−${fee.toFixed(2)}</span>
                  <span className="mx-2 text-amber-400">→</span>
                  Net credited: <span className="font-mono font-semibold">${net.toFixed(2)} {currency}</span>
                </p>
              </div>
            )}

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
              <button type="submit" disabled={loading}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                {loading ? "Processing…" : "Confirm Credit"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
