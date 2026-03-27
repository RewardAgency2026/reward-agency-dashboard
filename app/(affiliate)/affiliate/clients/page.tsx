"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  paused: "bg-amber-50 text-amber-700 border border-amber-200",
  churned: "bg-gray-100 text-gray-500",
};

const SOURCE_BADGE: Record<string, string> = {
  affiliate_link: "bg-blue-50 text-blue-700 border border-blue-200",
  manual: "bg-gray-100 text-gray-500",
};

const SOURCE_LABEL: Record<string, string> = {
  affiliate_link: "Affiliate Link",
  manual: "Manual",
};

interface AffiliateClient {
  id: string;
  client_code: string;
  name: string;
  company: string;
  status: string;
  onboarding_source: string;
  created_at: string;
}

export default function AffiliateClientsPage() {
  const [search, setSearch] = useState("");

  const { data: clients = [], isLoading } = useQuery<AffiliateClient[]>({
    queryKey: ["affiliate-clients"],
    queryFn: () => fetch("/api/affiliate/clients").then((r) => r.json()),
    staleTime: 0,
  });

  const filtered = clients.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.client_code.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Clients</h1>
        <p className="text-sm text-gray-500 mt-0.5">{clients.length} client{clients.length !== 1 ? "s" : ""} referred</p>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name or client code…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
      />

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3 animate-pulse flex gap-4">
                <div className="h-4 bg-gray-100 rounded w-24" />
                <div className="h-4 bg-gray-100 rounded w-40" />
                <div className="h-4 bg-gray-100 rounded w-16 ml-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-400">
              {clients.length === 0
                ? "No clients yet. Share your referral link to get started."
                : "No clients match your search."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Client Code</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Source</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-mono text-xs text-gray-700">{c.client_code}</td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.company}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[c.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_BADGE[c.onboarding_source] ?? "bg-gray-100 text-gray-500"}`}>
                      {SOURCE_LABEL[c.onboarding_source] ?? c.onboarding_source}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
