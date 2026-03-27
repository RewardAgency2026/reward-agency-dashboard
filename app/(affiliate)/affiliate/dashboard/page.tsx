"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { cn } from "@/lib/utils";

// ── Date helpers ──────────────────────────────────────────────────────────────

type Preset = "today" | "3d" | "7d" | "30d" | "custom";

function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function dateRange(preset: Preset, customFrom: string, customTo: string): { from: string; to: string } {
  const today = isoDate(new Date());
  const ago = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return isoDate(d);
  };
  switch (preset) {
    case "today":  return { from: today, to: today };
    case "3d":     return { from: ago(2), to: today };
    case "7d":     return { from: ago(6), to: today };
    case "30d":    return { from: ago(29), to: today };
    case "custom": return { from: customFrom || today, to: customTo || today };
  }
}

function periodLabel(preset: Preset, customFrom: string, customTo: string): string {
  switch (preset) {
    case "today":  return "Today";
    case "3d":     return "Last 3 Days";
    case "7d":     return "Last 7 Days";
    case "30d":    return "Last 30 Days";
    case "custom": {
      if (!customFrom || !customTo) return "";
      const f = new Date(customFrom + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const t = new Date(customTo + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return f === t ? f : `${f} – ${t}`;
    }
  }
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCompact(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${fmt(n)}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 animate-pulse">
      <div className="h-3 bg-gray-100 rounded w-24 mb-2" />
      <div className="h-8 bg-gray-100 rounded w-32" />
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  active:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
  paused:  "bg-amber-50 text-amber-700 border border-amber-200",
  churned: "bg-gray-100 text-gray-500",
};

const PRESETS: { value: Preset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "3d",    label: "Last 3 Days" },
  { value: "7d",    label: "Last 7 Days" },
  { value: "30d",   label: "Last 30 Days" },
  { value: "custom", label: "Custom" },
];

// ── Data interface ────────────────────────────────────────────────────────────

interface DashboardData {
  affiliate_code: string;
  total_clients: number;
  active_clients: number;
  current_month_commission: number;
  total_paid: number;
  pending_payment: number;
  monthly_chart: { period_year: number; period_month: number; commission_amount: number; status: string }[];
  recent_clients: { id: string; client_code: string; name: string; company: string; status: string; created_at: string }[];
  period_commission: number;
  period_topups_volume: number;
  period_topups_count: number;
  daily_data: { date: string; topup_volume: number; commission_earned: number }[];
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AffiliateDashboardPage() {
  const { data: session } = useSession();
  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { from, to } = useMemo(
    () => dateRange(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  const label = useMemo(
    () => periodLabel(preset, customFrom, customTo),
    [preset, customFrom, customTo]
  );

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["affiliate-dashboard", from, to],
    queryFn: () => fetch(`/api/affiliate/dashboard?from=${from}&to=${to}`).then((r) => r.json()),
    staleTime: 0,
    refetchInterval: 60000,
    enabled: preset !== "custom" || (!!customFrom && !!customTo),
  });

  const firstName = session?.user.name?.split(" ")[0] ?? "";
  const affiliateCode = data?.affiliate_code ?? "";

  const barChartData = (data?.monthly_chart ?? []).map((r) => ({
    month: MONTH_NAMES[r.period_month - 1],
    amount: r.commission_amount,
  }));

  const lineChartData = (data?.daily_data ?? []).map((r) => ({
    date: r.date,
    label: fmtDate(r.date),
    topup_volume: r.topup_volume,
    commission_earned: r.commission_earned,
  }));

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Welcome back, {firstName}
            {affiliateCode && (
              <> · <span className="font-mono text-gray-400">{affiliateCode}</span></>
            )}
          </p>
        </div>
      </div>

      {/* Overview KPIs (static — not date-filtered) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiCard label="Total Clients Referred" value={String(data?.total_clients ?? 0)} />
            <KpiCard label="Active Clients" value={String(data?.active_clients ?? 0)} color="text-emerald-600" />
            <KpiCard
              label="This Month's Commission"
              value={`$${fmt(data?.current_month_commission ?? 0)}`}
              sub="In progress"
              color="text-blue-600"
            />
            <KpiCard
              label="Pending Payment"
              value={`$${fmt(data?.pending_payment ?? 0)}`}
              sub="Approved — awaiting transfer"
              color={(data?.pending_payment ?? 0) > 0 ? "text-amber-600" : "text-gray-400"}
            />
            <KpiCard
              label="Total Commissions Paid"
              value={`$${fmt(data?.total_paid ?? 0)}`}
              color="text-emerald-600"
            />
          </>
        )}
      </div>

      {/* Date selector */}
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide mr-1">Period</span>
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => {
              if (p.value === "custom" && !customFrom) {
                // Seed custom range with today
                const today = isoDate(new Date());
                setCustomFrom(today);
                setCustomTo(today);
              }
              setPreset(p.value);
            }}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              preset === p.value
                ? "bg-[hsl(236,85%,55%)] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {p.label}
          </button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[hsl(236,85%,55%)]"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              onChange={(e) => setCustomTo(e.target.value)}
              className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[hsl(236,85%,55%)]"
            />
          </div>
        )}
      </div>

      {/* Period KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiCard
              label={`Earned ${label}`}
              value={`$${fmt(data?.period_commission ?? 0)}`}
              sub="Commission earned in period"
              color="text-[hsl(236,85%,55%)]"
            />
            <KpiCard
              label={`Top Ups ${label}`}
              value={fmtCompact(data?.period_topups_volume ?? 0)}
              sub="Total top up volume"
              color="text-gray-900"
            />
            <KpiCard
              label="Top Ups Count"
              value={String(data?.period_topups_count ?? 0)}
              sub={`Top ups executed ${label.toLowerCase()}`}
            />
          </>
        )}
      </div>

      {/* Dual-line chart: Daily Performance */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-sm font-semibold text-gray-700 mb-4">
          Daily Performance
          {label && <span className="ml-2 text-xs font-normal text-gray-400">{label}</span>}
        </p>
        {isLoading ? (
          <div className="h-56 bg-gray-50 rounded animate-pulse" />
        ) : lineChartData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-gray-400">
            No top ups in this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
                width={70}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
                width={60}
              />
              <Tooltip
                formatter={(value, name) => [
                  `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                  name === "topup_volume" ? "Top Up Volume" : "Commission Earned",
                ]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend
                formatter={(value) =>
                  value === "topup_volume" ? "Top Up Volume" : "Commission Earned"
                }
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="topup_volume"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: lineChartData.length === 1 ? 5 : 3 }}
                activeDot={{ r: 6 }}
                name="topup_volume"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="commission_earned"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: lineChartData.length === 1 ? 5 : 3 }}
                activeDot={{ r: 6 }}
                name="commission_earned"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom row: Commission History + Recent Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Commission History (bar chart — last 6 months, static) */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Commission History (Last 6 Months)</p>
          {isLoading ? (
            <div className="h-48 bg-gray-50 rounded animate-pulse" />
          ) : barChartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-gray-400">No commission data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
                <Tooltip
                  formatter={(v) => [`$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Commission"]}
                />
                <Bar dataKey="amount" fill="hsl(236,85%,55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Clients */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Recent Clients</p>
          </div>
          {isLoading ? (
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-3 animate-pulse flex items-center gap-4">
                  <div className="h-4 bg-gray-100 rounded w-20" />
                  <div className="h-4 bg-gray-100 rounded w-32" />
                  <div className="h-4 bg-gray-100 rounded w-16 ml-auto" />
                </div>
              ))}
            </div>
          ) : (data?.recent_clients ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No clients yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {(data?.recent_clients ?? []).map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900 text-xs">{c.name}</p>
                      <p className="text-gray-400 text-xs font-mono">{c.client_code}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[c.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400 text-right whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
