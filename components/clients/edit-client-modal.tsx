"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Pencil } from "lucide-react";

interface Affiliate {
  id: string;
  name: string;
  affiliate_code: string;
}

type PlatformFees = { meta: number; google: number; tiktok: number; snapchat: number; linkedin: number };
const PLATFORMS: (keyof PlatformFees)[] = ["meta", "google", "tiktok", "snapchat", "linkedin"];
const PLATFORM_LABELS: Record<keyof PlatformFees, string> = {
  meta: "Meta", google: "Google", tiktok: "TikTok", snapchat: "Snapchat", linkedin: "LinkedIn",
};

interface Client {
  id: string;
  name: string;
  company: string;
  status: string;
  crypto_fee_rate: string;
  billing_currency: string;
  affiliate_id: string | null;
  client_platform_fees: PlatformFees | null;
}

interface Props {
  client: Client;
  affiliates: Affiliate[];
}

const inputCls = "w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]";

function buildFormState(client: Client) {
  return {
    name: client.name,
    company: client.company,
    status: client.status,
    crypto_fee_rate: parseFloat(client.crypto_fee_rate),
    billing_currency: client.billing_currency,
    affiliate_id: client.affiliate_id ?? "",
  };
}

function buildPlatformFees(client: Client): PlatformFees {
  return client.client_platform_fees ?? { meta: 0, google: 0, tiktok: 0, snapchat: 0, linkedin: 0 };
}

export function EditClientModal({ client, affiliates }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState(() => buildFormState(client));
  const [platformFees, setPlatformFees] = useState<PlatformFees>(() => buildPlatformFees(client));

  function set(field: string, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function setPlatformFee(platform: keyof PlatformFees, value: number) {
    setPlatformFees((f) => ({ ...f, [platform]: value }));
  }

  function handleClose() {
    setOpen(false);
    // Reset form to current client values so stale edits don't persist
    setForm(buildFormState(client));
    setPlatformFees(buildPlatformFees(client));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          affiliate_id: form.affiliate_id || null,
          client_platform_fees: platformFees,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Update failed");
        return;
      }
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
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <Pencil size={14} />
        Edit
      </button>

      <div className={open ? "fixed inset-0 z-50 flex items-center justify-center" : "hidden"}>
        <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
        <div className="relative w-full max-w-lg mx-4 bg-white rounded-lg shadow-xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 flex-shrink-0">
            <h2 className="text-base font-semibold text-gray-900">Edit Client</h2>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Company</label>
                <input value={form.company} onChange={(e) => set("company", e.target.value)} className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="churned">Churned</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Billing Currency</label>
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

            {/* Commission Rates */}
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
                {loading ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
