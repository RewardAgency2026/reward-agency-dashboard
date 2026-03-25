"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";

const PLATFORMS = ["meta", "google", "tiktok", "snapchat", "linkedin"] as const;
const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta", google: "Google", tiktok: "TikTok", snapchat: "Snapchat", linkedin: "LinkedIn",
};

type PlatformKey = typeof PLATFORMS[number];
type Fees = Record<PlatformKey, string>;
const DEFAULT_FEES: Fees = { meta: "", google: "", tiktok: "", snapchat: "", linkedin: "" };

const inputCls = "w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]";

interface Props {
  supplierId: string;
}

export function AddSubAccountModal({ supplierId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [fees, setFees] = useState<Fees>(DEFAULT_FEES);

  function reset() {
    setName("");
    setFees(DEFAULT_FEES);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const platform_fees: Partial<Record<PlatformKey, number>> = {};
      for (const p of PLATFORMS) {
        const val = parseFloat(fees[p]);
        if (!isNaN(val) && val > 0) platform_fees[p] = val;
      }

      const res = await fetch(`/api/suppliers/${supplierId}/sub-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, platform_fees }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create sub-account"); return; }
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
        Add Sub-Account
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg mx-4 bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Add Sub-Account</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sub-Account Name *</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Whitehat" className={inputCls} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-3">Platform Fees (%) <span className="font-normal text-gray-400">— leave blank if not used</span></p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {PLATFORMS.map((p) => (
                    <div key={p}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{PLATFORM_LABELS[p]}</label>
                      <input
                        type="number" min="0" max="100" step="0.01"
                        value={fees[p]}
                        onChange={(e) => setFees((f) => ({ ...f, [p]: e.target.value }))}
                        placeholder="0.00"
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
              </div>
              {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="rounded-md bg-[hsl(236,85%,55%)] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] disabled:opacity-50">
                  {loading ? "Creating…" : "Create Sub-Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
