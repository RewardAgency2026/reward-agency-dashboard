"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface ClientOption {
  id: string;
  name: string;
  client_code: string;
  balance_model: string;
  wallet_balance: number;
  billing_currency: string;
}

interface AdAccountOption {
  id: string;
  client_id: string;
  platform: string;
  account_name: string;
  status: string;
}

interface Props {
  clients: ClientOption[];
  adAccounts: AdAccountOption[];
  prefillClientId?: string;
  label?: string;
}

const CURRENCIES = ["USD", "EUR", "USDT", "USDC"] as const;

export function NewRequestModal({ clients, adAccounts, prefillClientId, label }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [clientId, setClientId] = useState(prefillClientId ?? "");
  const [adAccountId, setAdAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<typeof CURRENCIES[number]>("USD");
  const [notes, setNotes] = useState("");

  const selectedClient = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);
  const filteredAdAccounts = useMemo(
    () => adAccounts.filter((a) => a.client_id === clientId && a.status === "active"),
    [adAccounts, clientId]
  );

  const parsedAmount = parseFloat(amount) || 0;
  const balanceOk = selectedClient && parsedAmount > 0 && selectedClient.wallet_balance >= parsedAmount;
  const balanceInsufficient = selectedClient && parsedAmount > 0 && selectedClient.wallet_balance < parsedAmount;

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) {
      setError("");
      if (!prefillClientId) setClientId("");
      setAdAccountId("");
      setAmount("");
      setCurrency("USD");
      setNotes("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !adAccountId || !parsedAmount) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/topup-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          ad_account_id: adAccountId,
          amount: parsedAmount,
          currency,
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create request");
      } else {
        handleOpenChange(false);
        router.refresh();
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
        onClick={() => handleOpenChange(true)}
        className="rounded-lg bg-[hsl(236,85%,55%)] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] transition-colors"
      >
        {label ?? "New Top-Up"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">New Top-Up</h2>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 space-y-4">
                {/* Client */}
                {!prefillClientId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Client <span className="text-red-500">*</span></label>
                    <select
                      value={clientId}
                      onChange={(e) => { setClientId(e.target.value); setAdAccountId(""); }}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
                    >
                      <option value="">Select client…</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.client_code} — {c.name} (balance: {c.wallet_balance.toFixed(2)} {c.billing_currency})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Ad Account */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ad Account <span className="text-red-500">*</span></label>
                  <select
                    value={adAccountId}
                    onChange={(e) => setAdAccountId(e.target.value)}
                    disabled={!clientId}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)] disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">Select ad account…</option>
                    {filteredAdAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.platform.charAt(0).toUpperCase() + a.platform.slice(1)} — {a.account_name}
                      </option>
                    ))}
                  </select>
                  {clientId && filteredAdAccounts.length === 0 && (
                    <p className="mt-1 text-xs text-gray-400">No active ad accounts for this client.</p>
                  )}
                </div>

                {/* Amount + Currency */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as typeof CURRENCIES[number])}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
                    >
                      {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {/* Balance check */}
                {selectedClient && parsedAmount > 0 && (
                  <div className={cn(
                    "rounded-lg px-4 py-2.5 text-sm flex items-center gap-2",
                    balanceOk ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                  )}>
                    <span>{balanceOk ? "✓" : "⚠"}</span>
                    <span>
                      {balanceOk
                        ? `Sufficient balance (${selectedClient.wallet_balance.toFixed(2)} ${selectedClient.billing_currency})`
                        : `Insufficient funds — balance: ${selectedClient.wallet_balance.toFixed(2)} ${selectedClient.billing_currency}`}
                    </span>
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional notes…"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)] resize-none"
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>

              <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !clientId || !adAccountId || !parsedAmount}
                  className="rounded-lg bg-[hsl(236,85%,55%)] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] transition-colors disabled:opacity-50"
                >
                  {loading ? "Creating…" : balanceInsufficient ? "Create (Insufficient Funds)" : "Create Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
