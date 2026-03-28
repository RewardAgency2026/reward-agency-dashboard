"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { ArrowLeft, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddSubAccountModal } from "./add-sub-account-modal";
import { EditSubAccountModal } from "./edit-sub-account-modal";
import { RecordPaymentModal } from "./record-payment-modal";

interface PlatformFee {
  id: string;
  platform: string;
  fee_rate: string;
}

interface SubAccount {
  id: string;
  name: string;
  status: string;
  platform_fees: PlatformFee[];
}

interface AdAccountSummary {
  id: string;
  platform: string;
  account_id: string;
  account_name: string;
  top_up_fee_rate: string;
  status: string;
  supplier_sub_account_id: string | null;
  sub_account_name: string | null;
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

interface Kpis {
  total_payments_sent: number;
  total_topups: number;
  remaining_balance: number;
  total_ad_accounts: number;
  total_sub_accounts: number;
}

interface Supplier {
  id: string;
  name: string;
  contact_email: string | null;
  status: string;
  created_at: string;
  sub_accounts: SubAccount[];
  ad_accounts: AdAccountSummary[];
  payments: Payment[];
  kpis: Kpis;
}

interface Props {
  supplier: Supplier;
  isAdmin: boolean;
}

const TABS = ["Sub-Accounts", "Ad Accounts", "Payments", "Transactions"] as const;

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta", google: "Google", tiktok: "TikTok", snapchat: "Snapchat", linkedin: "LinkedIn",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  inactive: "bg-gray-100 text-gray-500",
  paused: "bg-amber-50 text-amber-700 border border-amber-200",
  closed: "bg-gray-100 text-gray-500",
  disabled: "bg-red-50 text-red-600 border border-red-200",
  deleted: "bg-red-100 text-red-900 border border-red-300 line-through",
  paid: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface SupplierTxnRow {
  id: string;
  type: string;
  amount: string;
  currency: string;
  description: string | null;
  created_at: string;
  ad_account_name: string | null;
  ad_account_platform: string | null;
  sub_account_name: string | null;
  client_name: string | null;
  client_code: string | null;
  supplier_fee_amount: string | null;
  payment_method: string | null;
  reference: string | null;
  bank_fees: string | null;
  bank_fees_note: string | null;
  status: string | null;
}

type TxnPreset = "today" | "7d" | "30d" | "custom";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

const TXN_LABEL: Record<string, string> = {
  supplier_payment: "Payment Sent",
  topup: "Top Up",
  ad_account_withdrawal: "Withdrawal",
  supplier_fee: "Provider Fee",
  supplier_fee_refund: "Provider Fee Refund",
  commission_fee: "Client Commission Fee",
};

const TXN_BADGE: Record<string, string> = {
  supplier_payment: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  topup: "bg-blue-50 text-blue-700 border border-blue-200",
  ad_account_withdrawal: "bg-orange-50 text-orange-700 border border-orange-200",
  supplier_fee: "bg-red-50 text-red-700 border border-red-200",
  supplier_fee_refund: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  commission_fee: "bg-orange-50 text-orange-700 border border-orange-200",
};

// Types where amount is a credit (positive) to the supplier balance
const SUPPLIER_CREDIT_TYPES = new Set(["supplier_payment", "supplier_fee_refund", "ad_account_withdrawal"]);

function getSignedAmount(r: SupplierTxnRow): string {
  const amt = parseFloat(r.amount).toFixed(2);
  if (SUPPLIER_CREDIT_TYPES.has(r.type)) return `+${amt}`;
  if (r.type === "supplier_fee" || r.type === "topup") return `-${amt}`;
  return amt;
}

function downloadCsv(rows: SupplierTxnRow[], supplierName: string, from: string, to: string) {
  const safeName = supplierName.replace(/\s+/g, "_").toLowerCase();
  const filename = `supplier_${safeName}_transactions_${from}_${to}.csv`;
  const header = "Date,Type,Client Code,Client Name,Ad Account,Sub-Account,Platform,Amount,Currency,Method,Reference,Bank Fees,Description";
  const lines = rows.map((r) => [
    new Date(r.created_at).toLocaleDateString("en-GB"),
    TXN_LABEL[r.type] ?? r.type,
    r.client_code ?? "",
    r.client_name ?? "",
    r.ad_account_name ?? "",
    r.sub_account_name ?? "",
    r.ad_account_platform ?? "",
    getSignedAmount(r),
    r.currency,
    r.payment_method ?? "",
    r.reference ?? "",
    r.bank_fees ? parseFloat(r.bank_fees).toFixed(2) : "",
    (r.description ?? "").replace(/,/g, " "),
  ].join(","));
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SupplierTransactionsTab({ supplierId, supplierName }: { supplierId: string; supplierName: string }) {
  const [preset, setPreset] = useState<TxnPreset>("30d");
  const [customFrom, setCustomFrom] = useState(daysAgoStr(30));
  const [customTo, setCustomTo] = useState(todayStr());

  const from = preset === "today" ? todayStr()
    : preset === "7d" ? daysAgoStr(7)
    : preset === "30d" ? daysAgoStr(30)
    : customFrom;

  const to = preset === "custom" ? customTo : todayStr();

  const { data: rows = [], isLoading } = useQuery<SupplierTxnRow[]>({
    queryKey: ["supplier-transactions", supplierId, from, to],
    queryFn: () =>
      fetch(`/api/suppliers/${supplierId}/transactions?from=${from}&to=${to}`).then((r) => r.json()),
    staleTime: 60000,
  });

  const PRESETS: { value: TxnPreset; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "7d", label: "Last 7 Days" },
    { value: "30d", label: "Last 30 Days" },
    { value: "custom", label: "Custom" },
  ];

  return (
    <div className="space-y-4">
      {/* Date selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                preset === p.value
                  ? "bg-[hsl(236,85%,55%)] text-white"
                  : "text-gray-600 hover:bg-gray-50"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-md border border-gray-200 px-2 py-1 text-xs"
            />
            <span className="text-gray-400 text-xs">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-md border border-gray-200 px-2 py-1 text-xs"
            />
          </div>
        )}
        <div className="ml-auto">
          <button
            onClick={() => downloadCsv(rows, supplierName, from, to)}
            disabled={rows.length === 0}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3 animate-pulse flex gap-4">
                <div className="h-4 bg-gray-100 rounded w-20" />
                <div className="h-4 bg-gray-100 rounded w-16" />
                <div className="h-4 bg-gray-100 rounded w-32" />
                <div className="h-4 bg-gray-100 rounded w-20 ml-auto" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">No transactions in this period.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Date", "Type", "Client / Method", "Ad Account / Bank Fees", "Amount"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TXN_BADGE[r.type] ?? "bg-gray-100 text-gray-600")}>
                      {TXN_LABEL[r.type] ?? r.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.type === "supplier_payment" ? (
                      <div>
                        <p className="text-gray-700">{r.payment_method ?? "—"}</p>
                        {r.reference && <p className="text-xs font-mono text-gray-400">Ref: {r.reference}</p>}
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-gray-900">{r.client_name ?? "—"}</p>
                        {r.client_code && <p className="text-xs font-mono text-gray-400">{r.client_code}</p>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.type === "supplier_payment" ? (
                      r.bank_fees ? (
                        <div>
                          <p className="text-xs text-gray-500">Bank fees</p>
                          <p className="font-mono text-xs text-gray-700">{parseFloat(r.bank_fees).toFixed(2)} {r.currency}</p>
                          {r.bank_fees_note && <p className="text-xs text-gray-400">{r.bank_fees_note}</p>}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {r.ad_account_platform && <PlatformIcon platform={r.ad_account_platform} size={14} />}
                        <div>
                          <p className="text-gray-700">{r.ad_account_name ?? "—"}</p>
                          {r.sub_account_name && (
                            <p className="text-xs text-gray-400">{r.sub_account_name}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono font-medium whitespace-nowrap">
                    {SUPPLIER_CREDIT_TYPES.has(r.type) ? (
                      <span className="text-emerald-700">+{parseFloat(r.amount).toFixed(2)} {r.currency}</span>
                    ) : r.type === "supplier_fee" || r.type === "topup" ? (
                      <span className="text-red-600">-{parseFloat(r.amount).toFixed(2)} {r.currency}</span>
                    ) : (
                      <span className="text-gray-900">{parseFloat(r.amount).toFixed(2)} {r.currency}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-gray-400 px-1">Showing {rows.length} transaction{rows.length !== 1 ? "s" : ""}</p>
    </div>
  );
}

export function SupplierTabs({ supplier, isAdmin }: Props) {
  const [tab, setTab] = useState<typeof TABS[number]>("Sub-Accounts");

  const { kpis } = supplier;

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

      {/* Info */}
      <div className="mb-6 text-sm text-gray-500 flex items-center gap-6">
        {supplier.contact_email && <span>{supplier.contact_email}</span>}
        <span>Since {formatDate(supplier.created_at)}</span>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Payments Sent</p>
          <p className="text-lg font-bold font-mono text-gray-900">${fmt(kpis.total_payments_sent)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Total Top-Ups</p>
          <p className="text-lg font-bold font-mono text-gray-900">${fmt(kpis.total_topups)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Remaining Balance</p>
          <p className={cn("text-lg font-bold font-mono", kpis.remaining_balance >= 0 ? "text-emerald-600" : "text-red-500")}>
            ${fmt(kpis.remaining_balance)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Ad Accounts</p>
          <p className="text-lg font-bold text-gray-900">{kpis.total_ad_accounts}</p>
        </div>
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

      {/* Sub-Accounts */}
      {tab === "Sub-Accounts" && (
        <div>
          {isAdmin && (
            <div className="mb-4 flex justify-end">
              <AddSubAccountModal supplierId={supplier.id} />
            </div>
          )}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            {supplier.sub_accounts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No sub-accounts yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Name", "Platform Fees", "Status", ...(isAdmin ? ["Actions"] : [])].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {supplier.sub_accounts.map((sa) => (
                    <tr key={sa.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{sa.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {sa.platform_fees.filter((f) => parseFloat(f.fee_rate) > 0).map((f) => (
                            <span key={f.platform} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700">
                              <PlatformIcon platform={f.platform} size={13} />
                              {PLATFORM_LABELS[f.platform] ?? f.platform} {parseFloat(f.fee_rate)}%
                            </span>
                          ))}
                          {sa.platform_fees.filter((f) => parseFloat(f.fee_rate) > 0).length === 0 && (
                            <span className="text-xs text-gray-400">No fees set</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_BADGE[sa.status] ?? "bg-gray-100 text-gray-600")}>
                          {sa.status}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <EditSubAccountModal
                            supplierId={supplier.id}
                            subAccountId={sa.id}
                            currentName={sa.name}
                            currentStatus={sa.status}
                            currentFees={sa.platform_fees}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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
                  {["Platform", "Account", "Sub-Account", "Client", "Fee Rate", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {supplier.ad_accounts.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <PlatformIcon platform={a.platform} size={18} />
                        <span className="text-sm text-gray-700">{PLATFORM_LABELS[a.platform] ?? a.platform}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{a.account_name}</p>
                      <p className="text-xs font-mono text-gray-400">{a.account_id}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{a.sub_account_name ?? "—"}</td>
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

      {/* Transactions */}
      {tab === "Transactions" && (
        <SupplierTransactionsTab supplierId={supplier.id} supplierName={supplier.name} />
      )}
    </div>
  );
}

// ── Inline edit supplier ─────────────────────────────────────────────────────
function EditSupplierInline({
  supplierId, currentName, currentEmail, currentStatus,
}: {
  supplierId: string;
  currentName: string;
  currentEmail: string | null;
  currentStatus: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(currentName);
  const [email, setEmail] = useState(currentEmail ?? "");
  const [status, setStatus] = useState(currentStatus);

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
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
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
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
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
