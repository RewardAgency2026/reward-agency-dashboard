"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Plus, Trash2 } from "lucide-react";

const PLATFORMS = ["meta", "google", "tiktok", "snapchat", "linkedin"] as const;
const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta", google: "Google", tiktok: "TikTok", snapchat: "Snapchat", linkedin: "LinkedIn",
};

type PlatformKey = typeof PLATFORMS[number];
type Fees = Record<PlatformKey, string>;

interface SubAccountDraft {
  name: string;
  fees: Fees;
}

const emptyFees = (): Fees => ({ meta: "", google: "", tiktok: "", snapchat: "", linkedin: "" });
const emptySubAccount = (): SubAccountDraft => ({ name: "", fees: emptyFees() });

const inputCls = "w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]";

export function AddSupplierModal() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [subAccounts, setSubAccounts] = useState<SubAccountDraft[]>([emptySubAccount()]);

  function reset() {
    setName("");
    setContactEmail("");
    setSubAccounts([emptySubAccount()]);
    setError(null);
  }

  function updateSubAccount(idx: number, field: keyof SubAccountDraft, value: string) {
    setSubAccounts((prev) => prev.map((sa, i) => i === idx ? { ...sa, [field]: value } : sa));
  }

  function updateFee(idx: number, platform: PlatformKey, value: string) {
    setSubAccounts((prev) =>
      prev.map((sa, i) => i === idx ? { ...sa, fees: { ...sa.fees, [platform]: value } } : sa)
    );
  }

  function addSubAccount() {
    setSubAccounts((prev) => [...prev, emptySubAccount()]);
  }

  function removeSubAccount(idx: number) {
    setSubAccounts((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (subAccounts.length === 0 || subAccounts.every((sa) => !sa.name.trim())) {
      setError("At least one sub-account with a name is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Step 1: create supplier
      const supplierRes = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact_email: contactEmail || null }),
      });
      const supplierData = await supplierRes.json();
      if (!supplierRes.ok) { setError(supplierData.error ?? "Failed to create supplier"); return; }

      const supplierId: string = supplierData.id;

      // Step 2: create each sub-account with its fees
      // Note: if a sub-account POST fails, the supplier already exists (no rollback).
      // Any error is surfaced to the user.
      for (const sa of subAccounts.filter((s) => s.name.trim())) {
        const platform_fees: Partial<Record<PlatformKey, number>> = {};
        for (const p of PLATFORMS) {
          const val = parseFloat(sa.fees[p]);
          if (!isNaN(val) && val > 0) platform_fees[p] = val;
        }
        const saRes = await fetch(`/api/suppliers/${supplierId}/sub-accounts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: sa.name.trim(), platform_fees }),
        });
        if (!saRes.ok) {
          const saData = await saRes.json();
          setError(`Supplier created but sub-account "${sa.name}" failed: ${saData.error ?? "unknown error"}`);
          return;
        }
      }

      setOpen(false);
      reset();
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
        onClick={() => { reset(); setOpen(true); }}
        className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(236,85%,55%)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] transition-colors"
      >
        <Plus size={14} />
        Add Supplier
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-2xl mx-4 bg-white rounded-lg shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 flex-shrink-0">
              <h2 className="text-base font-semibold text-gray-900">Add Supplier</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6 overflow-y-auto flex-1">
              {/* Supplier basics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Supplier Name *</label>
                  <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contact Email</label>
                  <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="optional" className={inputCls} />
                </div>
              </div>

              {/* Sub-accounts */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-700">Sub-Accounts <span className="font-normal text-gray-400">(at least one required)</span></p>
                  <button type="button" onClick={addSubAccount} className="inline-flex items-center gap-1 text-xs text-[hsl(236,85%,55%)] hover:underline">
                    <Plus size={12} />
                    Add another
                  </button>
                </div>

                <div className="space-y-4">
                  {subAccounts.map((sa, idx) => (
                    <div key={idx} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-gray-600">Sub-Account {idx + 1}</span>
                        {subAccounts.length > 1 && (
                          <button type="button" onClick={() => removeSubAccount(idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                        <input
                          value={sa.name}
                          onChange={(e) => updateSubAccount(idx, "name", e.target.value)}
                          placeholder="e.g. Whitehat"
                          className={inputCls}
                        />
                      </div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Platform Fees (%)</p>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                        {PLATFORMS.map((p) => (
                          <div key={p}>
                            <label className="block text-xs text-gray-500 mb-1">{PLATFORM_LABELS[p]}</label>
                            <input
                              type="number" min="0" max="100" step="0.01"
                              value={sa.fees[p]}
                              onChange={(e) => updateFee(idx, p, e.target.value)}
                              placeholder="0.00"
                              className={inputCls}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="rounded-md bg-[hsl(236,85%,55%)] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] disabled:opacity-50">
                  {loading ? "Creating…" : "Create Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
