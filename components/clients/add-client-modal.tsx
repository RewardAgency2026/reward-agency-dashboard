"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import toast from "react-hot-toast";

interface Affiliate {
  id: string;
  name: string;
  affiliate_code: string;
}

// Matches the Client interface in clients-table.tsx
interface ClientRow {
  id: string;
  client_code: string;
  name: string;
  email: string;
  company: string;
  status: string;
  balance_model: string;
  billing_currency: string;
  wallet_balance: number;
  has_setup: boolean;
  affiliate_name: string | null;
  created_at: string;
}

interface Props {
  affiliates: Affiliate[];
  onSuccess?: (client: ClientRow) => void;
}

type PlatformFees = { meta: number; google: number; tiktok: number; snapchat: number; linkedin: number };
const PLATFORMS: (keyof PlatformFees)[] = ["meta", "google", "tiktok", "snapchat", "linkedin"];
const PLATFORM_LABELS: Record<keyof PlatformFees, string> = {
  meta: "Meta", google: "Google", tiktok: "TikTok", snapchat: "Snapchat", linkedin: "LinkedIn",
};
const DEFAULT_PLATFORM_FEES: PlatformFees = { meta: 0, google: 0, tiktok: 0, snapchat: 0, linkedin: 0 };

const inputCls = "w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]";

export function AddClientModal({ affiliates, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    balance_model: "classic" as "classic" | "dynamic",
    billing_currency: "USD" as "USD" | "EUR",
    crypto_fee_rate: 0,
    affiliate_id: "",
    notes: "",
    has_setup: false,
    setup_monthly_fee: "",
    setup_monthly_cost: "",
  });
  const [platformFees, setPlatformFees] = useState<PlatformFees>({ ...DEFAULT_PLATFORM_FEES });

  function set(field: string, value: string | number | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function setPlatformFee(platform: keyof PlatformFees, value: number) {
    setPlatformFees((f) => ({ ...f, [platform]: value }));
  }

  function resetForm() {
    setForm({
      name: "", email: "", company: "", balance_model: "classic",
      billing_currency: "USD", crypto_fee_rate: 0, affiliate_id: "",
      notes: "", has_setup: false, setup_monthly_fee: "", setup_monthly_cost: "",
    });
    setPlatformFees({ ...DEFAULT_PLATFORM_FEES });
    setError(null);
  }

  function handleClose() {
    setOpen(false);
    resetForm();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload: Record<string, unknown> = {
      ...form,
      affiliate_id: form.affiliate_id || null,
      notes: form.notes || null,
      setup_monthly_fee: form.setup_monthly_fee ? parseFloat(form.setup_monthly_fee) : null,
      setup_monthly_cost: form.setup_monthly_cost ? parseFloat(form.setup_monthly_cost) : null,
      client_platform_fees: platformFees,
    };

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create client");
        return;
      }
      const c = data.client;
      // Optimistic update — close immediately, update list, then background sync
      const affiliateObj = affiliates.find((a) => a.id === form.affiliate_id);
      onSuccess?.({
        id: c.id,
        client_code: c.client_code,
        name: c.name,
        email: c.email,
        company: c.company ?? "",
        status: c.status,
        balance_model: c.balance_model,
        billing_currency: c.billing_currency,
        wallet_balance: 0,
        has_setup: c.has_setup ?? false,
        affiliate_name: affiliateObj?.name ?? null,
        created_at: c.created_at,
      });
      handleClose();
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      if (data.emailSent) {
        toast.success(`Client ${c.client_code} created. Welcome email sent to ${c.email} ✓`);
      } else {
        toast(`Client ${c.client_code} created, but email failed to send. Please share credentials manually.`, {
          icon: "⚠️",
          style: { background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" },
        });
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
        onClick={() => setOpen(true)}
        className="rounded-md bg-[hsl(236,85%,55%)] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] transition-colors"
      >
        Add Client
      </button>

      <div className={open ? "fixed inset-0 z-50 flex items-center justify-center" : "hidden"}>
        <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
        <div className="relative w-full max-w-lg mx-4 bg-white rounded-lg shadow-xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 flex-shrink-0">
            <h2 className="text-base font-semibold text-gray-900">Add Client</h2>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                <input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Company</label>
                <input value={form.company} onChange={(e) => set("company", e.target.value)} className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Balance Model *</label>
                <select value={form.balance_model} onChange={(e) => set("balance_model", e.target.value)} className={inputCls}>
                  <option value="classic">Classic</option>
                  <option value="dynamic">Dynamic</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Billing Currency *</label>
                <select value={form.billing_currency} onChange={(e) => set("billing_currency", e.target.value)} className={inputCls}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Crypto Fee Rate (%)</label>
                <input type="number" min="0" max="100" step="0.01"
                  value={form.crypto_fee_rate}
                  onChange={(e) => set("crypto_fee_rate", parseFloat(e.target.value) || 0)}
                  className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Affiliate</label>
                <select value={form.affiliate_id} onChange={(e) => set("affiliate_id", e.target.value)} className={inputCls}>
                  <option value="">None</option>
                  {affiliates.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.affiliate_code})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                placeholder="Optional notes…"
                className={`${inputCls} resize-none`}
              />
            </div>

            {/* Setup toggle */}
            <div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.has_setup}
                  onClick={() => set("has_setup", !form.has_setup)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.has_setup ? "bg-purple-600" : "bg-gray-200"}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${form.has_setup ? "translate-x-[18px]" : "translate-x-[2px]"}`} />
                </button>
                <span className="text-sm font-medium text-gray-700">Has Setup</span>
              </div>

              {form.has_setup && (
                <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg border border-purple-100 bg-purple-50 p-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Monthly Fee (charged to client)</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.setup_monthly_fee}
                      onChange={(e) => set("setup_monthly_fee", e.target.value)}
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Monthly Cost (internal)</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={form.setup_monthly_cost}
                      onChange={(e) => set("setup_monthly_cost", e.target.value)}
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Platform fees */}
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-900 mb-0.5">Client Commission Rates (% per platform)</p>
              <p className="text-xs text-blue-600 mb-3">These rates define what the client pays on each top up per platform</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {PLATFORMS.map((p) => (
                  <div key={p}>
                    <label className="block text-xs text-gray-500 mb-1">{PLATFORM_LABELS[p]}</label>
                    <input
                      type="number" min="0" max="100" step="0.01"
                      value={platformFees[p]}
                      onChange={(e) => setPlatformFee(p, parseFloat(e.target.value) || 0)}
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={handleClose}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="rounded-md bg-[hsl(236,85%,55%)] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] disabled:opacity-50">
                {loading ? "Creating…" : "Create Client"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
