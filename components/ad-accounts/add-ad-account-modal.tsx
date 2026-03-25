"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type PlatformFees = { meta?: number; google?: number; tiktok?: number; snapchat?: number; linkedin?: number };

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

const PLATFORMS = ["meta", "google", "tiktok", "snapchat", "linkedin"] as const;
const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta", google: "Google", tiktok: "TikTok", snapchat: "Snapchat", linkedin: "LinkedIn",
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

  // Sub-accounts filtered by selected supplier
  const selectedSupplier = suppliers.find((s) => s.id === supplierId);
  const subAccounts = selectedSupplier?.sub_accounts ?? [];

  // Platforms available for selected sub-account (fee_rate > 0 only)
  const selectedSubAccount = subAccounts.find((sa) => sa.id === subAccountId);
  const availablePlatforms = useMemo(() => {
    if (!subAccountId || !selectedSubAccount) return PLATFORMS;
    return PLATFORMS.filter((p) => (selectedSubAccount.platform_fees?.[p] ?? 0) > 0);
  }, [subAccountId, selectedSubAccount]);
  const hasNoFees = subAccountId && availablePlatforms.length === 0;

  // Fee preview
  const selectedClient = clients.find((c) => c.id === clientId);
  const clientCommission = platform && selectedClient
    ? (selectedClient.client_platform_fees?.[platform as keyof PlatformFees] ?? 0)
    : null;
  const providerFee = platform && selectedSubAccount
    ? (selectedSubAccount.platform_fees?.[platform as keyof PlatformFees] ?? 0)
    : null;
  const margin = clientCommission !== null && providerFee !== null
    ? clientCommission - providerFee
    : null;

  // Reset sub-account + platform when supplier changes
  useEffect(() => {
    setSubAccountId("");
    setPlatform("");
  }, [supplierId]);

  // Reset platform when sub-account changes
  useEffect(() => {
    setPlatform("");
  }, [subAccountId]);

  function reset() {
    setClientId(prefillClientId ?? "");
    setSupplierId("");
    setSubAccountId("");
    setPlatform("");
    setAccountId("");
    setAccountName("");
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

      <div className={open ? "fixed inset-0 z-50 flex items-center justify-center" : "hidden"}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { reset(); setOpen(false); }} />
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

                {/* Sub-account */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sub-Account *</label>
                  <select required value={subAccountId} onChange={(e) => setSubAccountId(e.target.value)} className={inputCls} disabled={!supplierId}>
                    <option value="">{supplierId ? "Select sub-account…" : "Select supplier first"}</option>
                    {subAccounts.map((sa) => (
                      <option key={sa.id} value={sa.id}>{sa.name}</option>
                    ))}
                  </select>
                </div>

                {/* Platform */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Platform *</label>
                  {hasNoFees ? (
                    <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                      This sub-account has no platform fees configured. Please set up fees in the{" "}
                      <Link href="/suppliers" className="underline font-medium hover:text-amber-900">
                        Suppliers section
                      </Link>{" "}
                      first.
                    </p>
                  ) : (
                    <select required value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputCls} disabled={!subAccountId}>
                      <option value="">Select platform…</option>
                      {availablePlatforms.map((p) => (
                        <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                      ))}
                    </select>
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

              {/* Fee preview */}
              {platform && clientId && (
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Client Commission</span>
                    <span className={cn("font-mono font-medium", clientCommission !== null && clientCommission > 0 ? "text-emerald-700" : "text-gray-400")}>
                      {clientCommission !== null ? (clientCommission > 0 ? `${clientCommission}%` : "— (not set)") : "—"}
                    </span>
                  </div>
                  {selectedSubAccount && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Provider Fee <span className="text-gray-400">({selectedSubAccount.name})</span></span>
                      <span className={cn("font-mono font-medium", providerFee !== null && providerFee > 0 ? "text-red-600" : "text-gray-400")}>
                        {providerFee !== null ? (providerFee > 0 ? `${providerFee}%` : "—") : "—"}
                      </span>
                    </div>
                  )}
                  {margin !== null && (
                    <div className={cn("flex justify-between border-t border-gray-200 pt-1.5 font-semibold", margin >= 0 ? "text-gray-800" : "text-red-600")}>
                      <span>Gross Margin</span>
                      <span className="font-mono">{margin > 0 ? `${margin.toFixed(2)}%` : margin === 0 ? "0%" : `−${Math.abs(margin).toFixed(2)}%`}</span>
                    </div>
                  )}
                  {clientCommission === 0 && (
                    <p className="text-amber-600 mt-1">No commission rate set for this platform on the client — update client settings first.</p>
                  )}
                </div>
              )}

              {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { reset(); setOpen(false); }} className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="rounded-md bg-[hsl(236,85%,55%)] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] disabled:opacity-50">
                  {loading ? "Creating…" : "Create Ad Account"}
                </button>
              </div>
            </form>
          </div>
      </div>
    </>
  );
}
