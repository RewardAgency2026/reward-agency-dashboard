"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export interface AffiliateRow {
  id: string;
  affiliate_code: string;
  name: string;
  email: string;
  company: string;
  commission_rate: string;
  status: string;
  clients_count: number;
  commissions_paid: string;
  created_at: string;
}

interface Props {
  affiliates: AffiliateRow[];
  isLoading: boolean;
  onAdd: () => void;
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  inactive: "bg-gray-100 text-gray-500 border border-gray-200",
};

function TableSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="divide-y divide-gray-100">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-4 py-3 animate-pulse flex items-center gap-4">
            <div className="h-4 bg-gray-100 rounded w-24" />
            <div className="h-4 bg-gray-100 rounded w-40" />
            <div className="h-4 bg-gray-100 rounded w-32" />
            <div className="h-4 bg-gray-100 rounded w-16 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AffiliatesTable({ affiliates, isLoading, onAdd }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = affiliates.filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.affiliate_code.toLowerCase().includes(q) ||
      a.company.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, code..."
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)] w-64"
        />
        <button
          onClick={onAdd}
          className="ml-auto rounded-lg bg-[hsl(236,85%,55%)] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] transition-colors"
        >
          + Add Affiliate
        </button>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white">
          <p className="text-sm text-gray-400 text-center py-16">No affiliates found.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Company</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Commission</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Clients</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Paid Out</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => router.push(`/affiliates/${a.id}`)}
                  className="hover:bg-gray-50/50 cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.affiliate_code}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{a.name}</p>
                    <p className="text-xs text-gray-400">{a.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.company}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{parseFloat(a.commission_rate).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right text-gray-700">{a.clients_count}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">${parseFloat(a.commissions_paid).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", STATUS_BADGE[a.status] ?? "bg-gray-100 text-gray-500")}>
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-100 px-4 py-2">
            <p className="text-xs text-gray-400">Showing {filtered.length} affiliates</p>
          </div>
        </div>
      )}
    </div>
  );
}
