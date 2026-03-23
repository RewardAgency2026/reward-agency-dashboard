"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddSupplierModal } from "./add-supplier-modal";

interface Supplier {
  id: string;
  name: string;
  contact_email: string | null;
  status: string;
  created_at: string;
  platform_fees: Record<string, number>;
  ad_accounts_count: number;
}

interface Props {
  suppliers: Supplier[];
  isAdmin: boolean;
}

const PLATFORMS = ["meta", "google", "tiktok", "snapchat", "pinterest"] as const;

const PLATFORM_BADGE: Record<string, string> = {
  meta: "bg-blue-100 text-blue-700",
  google: "bg-red-100 text-red-700",
  tiktok: "bg-gray-900 text-white",
  snapchat: "bg-yellow-100 text-yellow-800",
  pinterest: "bg-rose-100 text-rose-700",
};

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta", google: "Google", tiktok: "TikTok", snapchat: "Snap", pinterest: "Pinterest",
};

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  inactive: "bg-gray-100 text-gray-500",
};

export function SuppliersTable({ suppliers, isAdmin }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return !q
      ? suppliers
      : suppliers.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.contact_email ?? "").toLowerCase().includes(q)
        );
  }, [suppliers, search]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
        {isAdmin && <AddSupplierModal />}
      </div>

      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search suppliers…"
            className="w-full rounded-md border border-gray-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Name", "Contact", "Platform Fees", "Ad Accounts", "Status", ""].map((h) => (
                <th key={h} className={cn(
                  "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide",
                  !h && "w-16"
                )}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                  No suppliers found.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.contact_email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {PLATFORMS.filter((p) => (s.platform_fees[p] ?? 0) > 0).map((p) => (
                        <span key={p} className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PLATFORM_BADGE[p])}>
                          {PLATFORM_LABELS[p]} {s.platform_fees[p]}%
                        </span>
                      ))}
                      {PLATFORMS.every((p) => !s.platform_fees[p]) && (
                        <span className="text-xs text-gray-400">No fees set</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.ad_accounts_count}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_BADGE[s.status] ?? "bg-gray-100 text-gray-600")}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/suppliers/${s.id}`}
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
    </div>
  );
}
