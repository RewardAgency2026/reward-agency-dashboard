"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { AddClientModal } from "./add-client-modal";
import { cn } from "@/lib/utils";

interface Affiliate {
  id: string;
  name: string;
  affiliate_code: string;
}

interface Client {
  id: string;
  client_code: string;
  name: string;
  email: string;
  company: string;
  status: string;
  balance_model: string;
  billing_currency: string;
  wallet_balance: number;
  affiliate_name: string | null;
  created_at: string;
}

interface Props {
  clients: Client[];
  affiliates: Affiliate[];
  isAdmin: boolean;
}

const STATUS_TABS = ["all", "active", "paused", "churned"] as const;

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  paused: "bg-amber-50 text-amber-700 border border-amber-200",
  churned: "bg-red-50 text-red-700 border border-red-200",
};

const MODEL_BADGE: Record<string, string> = {
  classic: "bg-gray-100 text-gray-600",
  dynamic: "bg-purple-50 text-purple-700 border border-purple-200",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function ClientsTable({ clients, affiliates, isAdmin }: Props) {
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<typeof STATUS_TABS[number]>("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.client_code.toLowerCase().includes(q);
      const matchesStatus = statusTab === "all" || c.status === statusTab;
      return matchesSearch && matchesStatus;
    });
  }, [clients, search, statusTab]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        {isAdmin && <AddClientModal affiliates={affiliates} />}
      </div>

      {/* Search */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or code…"
            className="w-full rounded-md border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
          />
        </div>
      </div>

      {/* Status tabs */}
      <div className="mb-4 flex gap-1 border-b border-gray-100">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusTab(tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
              statusTab === tab
                ? "border-[hsl(236,85%,55%)] text-[hsl(236,85%,55%)]"
                : "border-transparent text-gray-500 hover:text-gray-800"
            )}
          >
            {tab}
            <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
              {tab === "all" ? clients.length : clients.filter((c) => c.status === tab).length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Client</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Model</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Balance</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Currency</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Affiliate</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-400">
                  No clients found.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-gray-600">{c.client_code}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{c.name}</p>
                    {c.company && <p className="text-xs text-gray-400">{c.company}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", MODEL_BADGE[c.balance_model] ?? "bg-gray-100 text-gray-600")}>
                      {c.balance_model === "classic" ? "Classic" : "Dynamic"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span className={c.wallet_balance > 0 ? "text-emerald-600" : "text-red-500"}>
                      {c.wallet_balance.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.billing_currency}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_BADGE[c.status] ?? "bg-gray-100 text-gray-600")}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.affiliate_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${c.id}`}
                      className="rounded-md border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <p className="mt-3 text-xs text-gray-400">
          Showing {filtered.length} of {clients.length} clients
        </p>
      )}
    </div>
  );
}
