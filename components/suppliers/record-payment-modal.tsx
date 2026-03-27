"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, CreditCard } from "lucide-react";

interface Props {
  supplierId: string;
}

const inputCls = "w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]";

export function RecordPaymentModal({ supplierId }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    amount: "",
    currency: "USD",
    bank_fees: "",
    bank_fees_note: "",
    payment_method: "",
    reference: "",
    status: "paid",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function reset() {
    setForm({ amount: "", currency: "USD", bank_fees: "", bank_fees_note: "", payment_method: "", reference: "", status: "paid" });
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(form.amount),
          currency: form.currency,
          bank_fees: form.bank_fees ? parseFloat(form.bank_fees) : 0,
          bank_fees_note: form.bank_fees_note || null,
          payment_method: form.payment_method || null,
          reference: form.reference || null,
          status: form.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to record payment");
        return;
      }
      setOpen(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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
        <CreditCard size={14} />
        Record Payment
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg mx-4 bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Record Payment</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Amount *</label>
                  <input required type="number" min="0.01" step="0.01" value={form.amount}
                    onChange={(e) => set("amount", e.target.value)} placeholder="0.00" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
                  <select value={form.currency} onChange={(e) => set("currency", e.target.value)} className={inputCls}>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="USDT">USDT</option>
                    <option value="USDC">USDC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Bank Fees</label>
                  <input type="number" min="0" step="0.01" value={form.bank_fees}
                    onChange={(e) => set("bank_fees", e.target.value)} placeholder="0.00" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Bank Fees Note</label>
                  <input value={form.bank_fees_note} onChange={(e) => set("bank_fees_note", e.target.value)} placeholder="Optional" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                  <input value={form.payment_method} onChange={(e) => set("payment_method", e.target.value)} placeholder="e.g. Wire transfer" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reference</label>
                  <input value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="Optional" className={inputCls} />
                </div>
              </div>
              {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="rounded-md bg-[hsl(236,85%,55%)] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] disabled:opacity-50">
                  {loading ? "Saving…" : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
