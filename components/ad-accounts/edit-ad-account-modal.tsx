"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface SupplierOption {
  id: string;
  name: string;
  sub_accounts: Array<{ id: string; name: string; platform_fees: Record<string, number> }>;
}

interface AdAccount {
  id: string;
  platform: string;
  account_id: string;
  account_name: string;
  top_up_fee_rate: string;
  status: string;
  supplier_id: string;
  supplier_sub_account_id: string | null;
}

interface Props {
  adAccount: AdAccount;
  suppliers: SupplierOption[];
}

const PLATFORMS = ["meta", "google", "tiktok", "snapchat", "pinterest"] as const;
const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta", google: "Google", tiktok: "TikTok", snapchat: "Snapchat", pinterest: "Pinterest",
};

const inputCls = "w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]";

export function EditAdAccountModal({ adAccount, suppliers }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    platform: adAccount.platform,
    account_id: adAccount.account_id,
    account_name: adAccount.account_name,
    supplier_id: adAccount.supplier_id,
    supplier_sub_account_id: adAccount.supplier_sub_account_id ?? "",
    status: adAccount.status,
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Sub-accounts filtered by selected supplier
  const selectedSupplier = suppliers.find((s) => s.id === form.supplier_id);
  const subAccounts = selectedSupplier?.sub_accounts ?? [];
  const selectedSubAccount = subAccounts.find((sa) => sa.id === form.supplier_sub_account_id);

  // Read-only fee info
  const clientCommission = parseFloat(adAccount.top_up_fee_rate);
  const providerFee = selectedSubAccount?.platform_fees?.[form.platform] ?? null;
  const margin = providerFee !== null ? clientCommission - providerFee : null;

  const platformChanged = form.platform !== adAccount.platform;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        platform: form.platform,
        account_id: form.account_id,
        account_name: form.account_name,
        status: form.status,
      };
      if (form.supplier_sub_account_id) {
        body.supplier_sub_account_id = form.supplier_sub_account_id;
      }

      const res = await fetch(`/api/ad-accounts/${adAccount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Update failed"); return; }
      setOpen(false);
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
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <Pencil size={11} />
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg mx-4 bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Edit Ad Account</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Platform</label>
                  <select value={form.platform} onChange={(e) => set("platform", e.target.value)} className={inputCls}>
                    {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
                  </select>
                  {platformChanged && (
                    <p className="mt-1 text-xs text-amber-600">Changing platform will recalculate the commission rate from client settings.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                    <option value="deleted">Deleted</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Account ID</label>
                  <input required value={form.account_id} onChange={(e) => set("account_id", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Account Name</label>
                  <input required value={form.account_name} onChange={(e) => set("account_name", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Supplier</label>
                  <select value={form.supplier_id} onChange={(e) => set("supplier_id", e.target.value)} className={inputCls}>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sub-Account</label>
                  <select value={form.supplier_sub_account_id} onChange={(e) => set("supplier_sub_account_id", e.target.value)} className={inputCls}>
                    <option value="">None</option>
                    {subAccounts.map((sa) => <option key={sa.id} value={sa.id}>{sa.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Read-only fee display */}
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Client Commission <span className="text-gray-400">(from client settings)</span></span>
                  <span className={cn("font-mono font-medium", clientCommission > 0 ? "text-emerald-700" : "text-gray-400")}>
                    {clientCommission > 0 ? `${clientCommission}%` : "— (not set)"}
                  </span>
                </div>
                {providerFee !== null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Provider Fee <span className="text-gray-400">(from sub-account)</span></span>
                    <span className={cn("font-mono font-medium", providerFee > 0 ? "text-red-600" : "text-gray-400")}>
                      {providerFee > 0 ? `${providerFee}%` : "—"}
                    </span>
                  </div>
                )}
                {margin !== null && (
                  <div className={cn("flex justify-between border-t border-gray-200 pt-1.5 font-semibold", margin >= 0 ? "text-gray-800" : "text-red-600")}>
                    <span>Gross Margin</span>
                    <span className="font-mono">{margin > 0 ? `${margin.toFixed(2)}%` : margin === 0 ? "0%" : `−${Math.abs(margin).toFixed(2)}%`}</span>
                  </div>
                )}
              </div>

              {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="rounded-md bg-[hsl(236,85%,55%)] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] disabled:opacity-50">
                  {loading ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
