"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";

type PlatformFees = { meta?: number; google?: number; tiktok?: number; snapchat?: number; pinterest?: number };

interface SubAccountOption {
  id: string;
  name: string;
  platform_fees: PlatformFees;
}

interface SupplierOption {
  id: string;
  name: string;
  sub_accounts: SubAccountOption[];
}

interface ClientOption {
  id: string;
  name: string;
  client_code: string;
  client_platform_fees: PlatformFees | null;
}

interface Props {
  clients: ClientOption[];
  suppliers: SupplierOption[];
  prefillClientId?: string;
  label?: string;
}

const PLATFORMS = ["meta", "google", "tiktok", "snapchat", "pinterest"] as const;
const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta", google: "Google", tiktok: "TikTok", snapchat: "Snapchat", pinterest: "Pinterest",
};

const inputCls = "w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]";

export function AddAdAccountModal({ clients, suppliers, prefillClientId, label = "Add Ad Account" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState(prefillClientId ?? "");
  const [supplierId, setSupplierId] = useState("");
  const [subAccountId, setSubAccountId] = useState("");
  const [platform, setPlatform] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [feeRate, setFeeRate] = useState("");

  // Sub-accounts filtered by selected supplier
  const selectedSupplier = suppliers.find((s) => s.id === supplierId);
  const subAccounts = selectedSupplier?.sub_accounts ?? [];

  // Reset sub-account when supplier changes
  useEffect(() => {
    setSubAccountId("");
    setFeeRate("");
  }, [supplierId]);

  // Auto-suggest fee rate from sub-account's platform fees
  useEffect(() => {
    if (!subAccountId || !platform) return;
    const subAccount = subAccounts.find((sa) => sa.id === subAccountId);
    const suggested = subAccount?.platform_fees?.[platform as keyof PlatformFees];
    if (suggested !== undefined) { setFeeRate(String(suggested)); return; }
    // Fallback: try client platform fees
    if (clientId) {
      const client = clients.find((c) => c.id === clientId);
      const clientSuggested = client?.client_platform_fees?.[platform as keyof PlatformFees];
      if (clientSuggested !== undefined) setFeeRate(String(clientSuggested));
    }
  }, [subAccountId, platform, subAccounts, clientId, clients]);

  function reset() {
    setClientId(prefillClientId ?? "");
    setSupplierId("");
    setSubAccountId("");
    setPlatform("");
    setAccountId("");
    setAccountName("");
    setFeeRate("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ad-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          supplier_sub_account_id: subAccountId,
          platform,
          account_id: accountId,
          account_name: accountName,
          top_up_fee_rate: parseFloat(feeRate) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create ad account"); return; }
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(236,85%,55%)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] transition-colors"
      >
        <Plus size={14} />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg mx-4 bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Add Ad Account</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Client — hidden if prefilled */}
                {!prefillClientId && (
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Client *</label>
                    <select required value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
                      <option value="">Select client…</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.client_code})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Supplier parent */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Supplier *</label>
                  <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputCls}>
                    <option value="">Select supplier…</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Sub-account — filtered by supplier */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sub-Account *</label>
                  <select required value={subAccountId} onChange={(e) => setSubAccountId(e.target.value)} className={inputCls} disabled={!supplierId}>
                    <option value="">{supplierId ? "Select sub-account…" : "Select supplier first"}</option>
                    {subAccounts.map((sa) => (
                      <option key={sa.id} value={sa.id}>{sa.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Platform *</label>
                  <select required value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputCls}>
                    <option value="">Select platform…</option>
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Top-Up Fee Rate (%)</label>
                  <input
                    type="number" min="0" max="100" step="0.01"
                    value={feeRate}
                    onChange={(e) => setFeeRate(e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                  />
                  {feeRate && subAccountId && platform && (
                    <p className="mt-1 text-xs text-gray-400">Auto-suggested from sub-account fees</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Account ID *</label>
                  <input required value={accountId} onChange={(e) => setAccountId(e.target.value)}
                    placeholder="e.g. act_123456789" className={inputCls} />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Account Name *</label>
                  <input required value={accountName} onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. Main Campaign" className={inputCls} />
                </div>
              </div>

              {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="rounded-md bg-[hsl(236,85%,55%)] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] disabled:opacity-50">
                  {loading ? "Creating…" : "Create Ad Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
