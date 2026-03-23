"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { SetFeeModal } from "./set-fee-modal";
import { RecordPaymentModal } from "./record-payment-modal";

interface PlatformFee {
  id: string;
  platform: string;
  fee_rate: string;
}

interface AdAccountSummary {
  id: string;
  platform: string;
  account_id: string;
  account_name: string;
  top_up_fee_rate: string;
  status: string;
  client_name: string | null;
  client_code: string | null;
}

interface Payment {
  id: string;
  amount: string;
  currency: string;
  bank_fees: string;
  bank_fees_note: string | null;
  payment_method: string | null;
  reference: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
}

interface Supplier {
  id: string;
  name: string;
  contact_email: string | null;
  status: string;
  created_at: string;
  platform_fees: PlatformFee[];
  ad_accounts: AdAccountSummary[];
  payments: Payment[];
}

interface Props {
  supplier: Supplier;
  isAdmin: boolean;
}

const TABS = ["Platform Fees", "Ad Accounts", "Payments"] as const;
const PLATFORMS = ["meta", "google", "tiktok", "snapchat", "pinterest"] as const;

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta", google: "Google", tiktok: "TikTok", snapchat: "Snapchat", pinterest: "Pinterest",
};

const PLATFORM_BADGE: Record<string, string> = {
  meta: "bg-blue-100 text-blue-700",
  google: "bg-red-100 text-red-700",
  tiktok: "bg-gray-900 text-white",
  snapchat: "bg-yellow-100 text-yellow-800",
  pinterest: "bg-rose-100 text-rose-700",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  inactive: "bg-gray-100 text-gray-500",
  paused: "bg-amber-50 text-amber-700 border border-amber-200",
  closed: "bg-gray-100 text-gray-500",
  paid: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function SupplierTabs({ supplier, isAdmin }: Props) {
  const [tab, setTab] = useState<typeof TABS[number]>("Platform Fees");

  const feeByPlatform = new Map(supplier.platform_fees.map((f) => [f.platform, parseFloat(f.fee_rate)]));

  return (
    <div>
      <Link href="/suppliers" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-4">
        <ArrowLeft size={13} />
        Back to Suppliers
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{supplier.name}</h1>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", STATUS_BADGE[supplier.status] ?? "bg-gray-100 text-gray-600")}>
            {supplier.status}
          </span>
        </div>
        {isAdmin && (
          <EditSupplierInline supplierId={supplier.id} currentName={supplier.name} currentEmail={supplier.contact_email} currentStatus={supplier.status} />
        )}
      </div>

      {/* Info strip */}
      <div className="mb-6 flex items-center gap-6 text-sm text-gray-500">
        {supplier.contact_email && <span>{supplier.contact_email}</span>}
        <span>Since {formatDate(supplier.created_at)}</span>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t ? "border-[hsl(236,85%,55%)] text-[hsl(236,85%,55%)]" : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >{t}</button>
          ))}
        </div>
      </div>

      {/* Platform Fees */}
      {tab === "Platform Fees" && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platform</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fee Rate</th>
                {isAdmin && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {PLATFORMS.map((p) => {
                const rate = feeByPlatform.get(p) ?? 0;
                return (
                  <tr key={p} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", PLATFORM_BADGE[p])}>
                        {PLATFORM_LABELS[p]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {rate > 0
                        ? <span className="text-gray-900 font-medium">{rate}%</span>
                        : <span className="text-gray-400">Not set</span>
                      }
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <SetFeeModal supplierId={supplier.id} platform={p} currentRate={rate} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Ad Accounts */}
      {tab === "Ad Accounts" && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {supplier.ad_accounts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No ad accounts linked to this supplier.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Platform", "Account", "Client", "Fee Rate", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {supplier.ad_accounts.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PLATFORM_BADGE[a.platform] ?? "bg-gray-100 text-gray-600")}>
                        {PLATFORM_LABELS[a.platform] ?? a.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{a.account_name}</p>
                      <p className="text-xs font-mono text-gray-400">{a.account_id}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {a.client_name ?? "—"}
                      {a.client_code && <span className="ml-1 text-xs text-gray-400">({a.client_code})</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{parseFloat(a.top_up_fee_rate)}%</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_BADGE[a.status] ?? "bg-gray-100 text-gray-600")}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Payments */}
      {tab === "Payments" && (
        <div>
          {isAdmin && (
            <div className="mb-4 flex justify-end">
              <RecordPaymentModal supplierId={supplier.id} />
            </div>
          )}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            {supplier.payments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No payments recorded.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Amount", "Currency", "Bank Fees", "Method", "Reference", "Status", "Date"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {supplier.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-mono font-medium">{parseFloat(p.amount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-600">{p.currency}</td>
                      <td className="px-4 py-3 font-mono text-gray-500">
                        {parseFloat(p.bank_fees) > 0 ? parseFloat(p.bank_fees).toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{p.payment_method ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.reference ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_BADGE[p.status] ?? "bg-gray-100 text-gray-600")}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline edit (name, email, status) ────────────────────────────────────────
function EditSupplierInline({
  supplierId, currentName, currentEmail, currentStatus,
}: {
  supplierId: string;
  currentName: string;
  currentEmail: string | null;
  currentStatus: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(currentName);
  const [email, setEmail] = useState(currentEmail ?? "");
  const [status, setStatus] = useState(currentStatus);

  const router = useRouter();

  const inputCls = "w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact_email: email || null, status }),
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
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
        <Pencil size={14} /> Edit
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md mx-4 bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Edit Supplier</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={0} /><span>✕</span></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contact Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {error && <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="rounded-md bg-[hsl(236,85%,55%)] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] disabled:opacity-50">
                  {loading ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
