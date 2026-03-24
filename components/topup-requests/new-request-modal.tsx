"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PlatformIcon } from "@/components/ui/platform-icon";

interface ClientOption {
  id: string;
  name: string;
  client_code: string;
  balance_model: string;
  wallet_balance: number;
  billing_currency: string;
  client_platform_fees: Record<string, number> | null;
}

interface AdAccountOption {
  id: string;
  client_id: string;
  platform: string;
  account_name: string;
  top_up_fee_rate: string;
  supplier_fee_rate: string | null;
  status: string;
}

interface Props {
  clients: ClientOption[];
  adAccounts: AdAccountOption[];
  prefillClientId?: string;
  label?: string;
}

const CURRENCIES = ["USD", "EUR", "USDT", "USDC"] as const;

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta", google: "Google", tiktok: "TikTok", snapchat: "Snapchat", pinterest: "Pinterest",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active", disabled: "Disabled", deleted: "Deleted",
};

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
    () => adAccounts.filter((a) => a.client_id === clientId),
    [adAccounts, clientId]
  );
  const selectedAdAccount = useMemo(() => adAccounts.find((a) => a.id === adAccountId), [adAccounts, adAccountId]);

  const parsedAmount = parseFloat(amount) || 0;

  // Fee calculations — commission rate from client_platform_fees (source of truth), not ad account field
  const commissionRate = selectedAdAccount && selectedClient
    ? (selectedClient.client_platform_fees?.[selectedAdAccount.platform] ?? 0)
    : 0;
  const commissionAmount = parsedAmount > 0 ? parsedAmount * (commissionRate / 100) : 0;
  const providerRate = selectedAdAccount?.supplier_fee_rate ? parseFloat(selectedAdAccount.supplier_fee_rate) : 0;
  const providerAmount = parsedAmount > 0 ? parsedAmount * (providerRate / 100) : 0;
  const grossMarginAmount = commissionAmount - providerAmount;
  const grossMarginRate = commissionRate - providerRate;

  // Balance check: only the top-up amount affects wallet balance (not fees)
  const newBalance = selectedClient ? selectedClient.wallet_balance - parsedAmount : 0;
  const balanceSufficient = selectedClient && parsedAmount > 0 && selectedClient.wallet_balance >= parsedAmount;
  const balanceInsufficient = selectedClient && parsedAmount > 0 && !balanceSufficient;

  const isDisabledAccount = selectedAdAccount && selectedAdAccount.status !== "active";

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
        setError(data.error ?? "Failed to create top up");
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

      <div className={open ? "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" : "hidden"}>
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
                  <div className="flex items-center gap-2">
                    {selectedAdAccount && <PlatformIcon platform={selectedAdAccount.platform} size={22} />}
                  <select
                    value={adAccountId}
                    onChange={(e) => setAdAccountId(e.target.value)}
                    disabled={!clientId}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)] disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">Select ad account…</option>
                    {filteredAdAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {PLATFORM_LABELS[a.platform] ?? a.platform} — {a.account_name}
                        {a.status !== "active" ? ` (${STATUS_LABELS[a.status] ?? a.status})` : ""}
                      </option>
                    ))}
                  </select>
                  </div>
                  {clientId && filteredAdAccounts.length === 0 && (
                    <p className="mt-1 text-xs text-gray-400">No ad accounts for this client.</p>
                  )}
                  {isDisabledAccount && (
                    <p className="mt-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                      This ad account is <strong>{selectedAdAccount.status}</strong> and cannot receive top ups.
                    </p>
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

                {/* Balance + fee preview */}
                {selectedClient && parsedAmount > 0 && (
                  <div className={cn(
                    "rounded-lg border px-4 py-3 text-sm space-y-1.5",
                    balanceSufficient ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
                  )}>
                    {/* Balance section */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-gray-600">
                        <span>Current Balance</span>
                        <span className="font-mono">{selectedClient.wallet_balance.toFixed(2)} {selectedClient.billing_currency}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Top Up Amount</span>
                        <span className="font-mono">−{parsedAmount.toFixed(2)} {currency}</span>
                      </div>
                      <div className={cn(
                        "flex justify-between border-t pt-1.5 font-semibold",
                        balanceSufficient ? "border-emerald-200" : "border-red-200"
                      )}>
                        <span className="text-gray-700">New Balance After</span>
                        <span className={cn("font-mono", newBalance < 0 ? "text-red-600" : "text-gray-900")}>
                          {newBalance.toFixed(2)} {selectedClient.billing_currency}
                        </span>
                      </div>
                    </div>

                    {/* Fee breakdown */}
                    {selectedAdAccount && (commissionRate > 0 || providerRate > 0) && (
                      <div className={cn(
                        "space-y-1 border-t pt-2 mt-1",
                        balanceSufficient ? "border-emerald-200" : "border-red-200"
                      )}>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Internal Fee Breakdown</p>
                        {commissionRate > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Client Commission ({commissionRate}%)</span>
                            <span className="font-mono text-emerald-700">+{commissionAmount.toFixed(2)} {currency}</span>
                          </div>
                        )}
                        {providerRate > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Provider Fee ({providerRate}%)</span>
                            <span className="font-mono text-red-600">−{providerAmount.toFixed(2)} {currency}</span>
                          </div>
                        )}
                        {(commissionRate > 0 || providerRate > 0) && (
                          <div className={cn(
                            "flex justify-between text-xs font-semibold border-t pt-1",
                            balanceSufficient ? "border-emerald-200" : "border-red-200",
                            grossMarginAmount >= 0 ? "text-gray-800" : "text-red-600"
                          )}>
                            <span>Gross Margin ({grossMarginRate.toFixed(2)}%)</span>
                            <span className="font-mono">{grossMarginAmount >= 0 ? "" : "−"}{Math.abs(grossMarginAmount).toFixed(2)} {currency}</span>
                          </div>
                        )}
                      </div>
                    )}
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
                  disabled={loading || !clientId || !adAccountId || !parsedAmount || !!isDisabledAccount}
                  className="rounded-lg bg-[hsl(236,85%,55%)] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] transition-colors disabled:opacity-50"
                >
                  {loading ? "Creating…" : balanceInsufficient ? "Create Top Up (Insufficient Funds)" : "Create Top Up"}
                </button>
              </div>
            </form>
          </div>
      </div>
    </>
  );
}
