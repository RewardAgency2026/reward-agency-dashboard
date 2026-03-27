"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Pencil } from "lucide-react";

const PLATFORMS = ["meta", "google", "tiktok", "snapchat", "linkedin"] as const;
const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta", google: "Google", tiktok: "TikTok", snapchat: "Snapchat", linkedin: "LinkedIn",
};

type PlatformKey = typeof PLATFORMS[number];

interface PlatformFee {
  platform: string;
  fee_rate: string;
}

interface Props {
  supplierId: string;
  subAccountId: string;
  currentName: string;
  currentStatus: string;
  currentFees: PlatformFee[];
}

const inputCls = "w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]";

export function EditSubAccountModal({ supplierId, subAccountId, currentName, currentStatus, currentFees }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(currentName);
  const [status, setStatus] = useState(currentStatus);

  function getFeeValue(platform: PlatformKey) {
    const fee = currentFees.find((f) => f.platform === platform);
    return fee ? String(parseFloat(fee.fee_rate)) : "";
  }

  const [fees, setFees] = useState<Record<PlatformKey, string>>({
    meta: getFeeValue("meta"),
    google: getFeeValue("google"),
    tiktok: getFeeValue("tiktok"),
    snapchat: getFeeValue("snapchat"),
    linkedin: getFeeValue("linkedin"),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const platform_fees: Partial<Record<PlatformKey, number>> = {};
      for (const p of PLATFORMS) {
        const val = parseFloat(fees[p]);
        platform_fees[p] = isNaN(val) ? 0 : val;
      }

      const res = await fetch(`/api/suppliers/${supplierId}/sub-accounts/${subAccountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, status, platform_fees }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Update failed"); return; }
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
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
              <h2 className="text-base font-semibold text-gray-900">Edit Sub-Account</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                  <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-3">Platform Fees (%) <span className="font-normal text-gray-400">— set 0 to clear</span></p>
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
