"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { AuditLogTable } from "@/components/audit-log/audit-log-table";

const TABS = ["Agency Info", "Team", "Audit Log"] as const;
type Tab = (typeof TABS)[number];

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-purple-50 text-purple-700 border border-purple-200",
  team: "bg-blue-50 text-blue-700 border border-blue-200",
  accountant: "bg-gray-100 text-gray-600",
};

interface SettingsRow {
  id?: string;
  agency_name: string;
  from_email: string | null;
  iban_usd: string | null;
  iban_eur: string | null;
  legal_mentions: string | null;
  agency_crypto_fee_rate: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

interface AuditLogRow {
  id: string;
  user_name: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

function AgencyInfoTab() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery<SettingsRow>({
    queryKey: ["settings"],
    queryFn: () => fetch("/api/settings").then((r) => r.json()),
  });

  const [agencyName, setAgencyName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [ibanUsd, setIbanUsd] = useState("");
  const [ibanEur, setIbanEur] = useState("");
  const [legalMentions, setLegalMentions] = useState("");
  const [cryptoFeeRate, setCryptoFeeRate] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);

  if (settings && !initialized) {
    setAgencyName(settings.agency_name ?? "");
    setFromEmail(settings.from_email ?? "");
    setIbanUsd(settings.iban_usd ?? "");
    setIbanEur(settings.iban_eur ?? "");
    setLegalMentions(settings.legal_mentions ?? "");
    setCryptoFeeRate(settings.agency_crypto_fee_rate ?? "0");
    setInitialized(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agency_name: agencyName,
          from_email: fromEmail || null,
          iban_usd: ibanUsd || null,
          iban_eur: ibanEur || null,
          legal_mentions: legalMentions || null,
          agency_crypto_fee_rate: parseFloat(cryptoFeeRate) || 0,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setToast(true);
      setTimeout(() => setToast(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i}>
            <div className="h-3 bg-gray-100 rounded w-24 mb-1.5" />
            <div className="h-9 bg-gray-100 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-5">
      {toast && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium">
          Settings saved successfully.
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Agency Name</label>
        <input
          type="text"
          value={agencyName}
          onChange={(e) => setAgencyName(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
        <input
          type="email"
          value={fromEmail}
          onChange={(e) => setFromEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
          placeholder="noreply@youragency.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">IBAN (USD)</label>
        <input
          type="text"
          value={ibanUsd}
          onChange={(e) => setIbanUsd(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
          placeholder="IBAN or bank details for USD"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">IBAN (EUR)</label>
        <input
          type="text"
          value={ibanEur}
          onChange={(e) => setIbanEur(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
          placeholder="IBAN or bank details for EUR"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Legal Mentions</label>
        <textarea
          value={legalMentions}
          onChange={(e) => setLegalMentions(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
          placeholder="Legal text appearing on invoices..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Crypto Fee Rate (%)</label>
        <input
          type="number"
          value={cryptoFeeRate}
          onChange={(e) => setCryptoFeeRate(e.target.value)}
          min={0}
          max={100}
          step={0.01}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg bg-[hsl(236,85%,55%)] px-6 py-2 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] transition-colors disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}

function TeamTab() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const isAdmin = session?.user.role === "admin";

  const { data: userList, isLoading } = useQuery<UserRow[]>({
    queryKey: ["agency-users"],
    queryFn: () => fetch("/api/users").then((r) => r.json()),
    enabled: isAdmin,
  });

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "team" | "accountant">("team");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create user");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["agency-users"] });
      setShowModal(false);
      setName("");
      setEmail("");
      setPassword("");
      setRole("team");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-500">Only admins can manage team members.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Add User Modal */}
      <div className={showModal ? "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" : "hidden"}>
        <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-gray-200 mx-4">
          <div className="px-6 py-5 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Add Team Member</h3>
          </div>
          <div className="px-6 py-5 space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "team" | "accountant")}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
              >
                <option value="admin">Admin</option>
                <option value="team">Team</option>
                <option value="accountant">Accountant</option>
              </select>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              onClick={() => { setShowModal(false); setError(""); }}
              className="rounded-lg px-4 py-2 text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={submitting || !name || !email || !password}
              className="rounded-lg bg-[hsl(236,85%,55%)] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] transition-colors disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create User"}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">{userList?.length ?? 0} team members</p>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-[hsl(236,85%,55%)] px-4 py-2 text-sm font-medium text-white hover:bg-[hsl(236,85%,48%)] transition-colors"
        >
          Add User
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-4 py-4 animate-pulse flex items-center gap-3">
              <div className="h-9 w-9 bg-gray-100 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-gray-100 rounded w-32 mb-1.5" />
                <div className="h-3 bg-gray-100 rounded w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : !userList || userList.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-400">No team members found.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {userList.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(236,85%,55%)] text-xs font-semibold text-white">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize whitespace-nowrap", ROLE_BADGE[u.role] ?? "bg-gray-100 text-gray-600")}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(u.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AuditLogTab() {
  const [actionFilter, setActionFilter] = useState("");

  const { data: logs, isLoading } = useQuery<AuditLogRow[]>({
    queryKey: ["audit-logs", actionFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (actionFilter) params.set("action", actionFilter);
      return fetch(`/api/audit-logs?${params}`).then((r) => r.json());
    },
  });

  const allActions = [
    { value: "", label: "All Actions" },
    { value: "topup_executed", label: "Top Up Executed" },
    { value: "topup_rejected", label: "Top Up Rejected" },
    { value: "topup_deleted", label: "Top Up Deleted" },
    { value: "balance_credited", label: "Balance Credited" },
    { value: "balance_withdrawn", label: "Balance Withdrawn" },
    { value: "client_created", label: "Client Created" },
    { value: "client_updated", label: "Client Updated" },
    { value: "supplier_created", label: "Supplier Created" },
    { value: "supplier_updated", label: "Supplier Updated" },
  ];

  return (
    <div>
      <div className="mb-4">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(236,85%,55%)]"
        >
          {allActions.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 animate-pulse flex items-center gap-4">
              <div className="h-4 bg-gray-100 rounded w-24" />
              <div className="h-4 bg-gray-100 rounded w-32" />
              <div className="h-4 bg-gray-100 rounded w-48" />
              <div className="h-4 bg-gray-100 rounded w-32 ml-auto" />
            </div>
          ))}
        </div>
      ) : (
        <AuditLogTable logs={logs ?? []} />
      )}
    </div>
  );
}

export function SettingsTabs() {
  const [activeTab, setActiveTab] = useState<Tab>("Agency Info");

  return (
    <div>
      {/* Tab navigation */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                activeTab === tab
                  ? "border-[hsl(236,85%,55%)] text-[hsl(236,85%,55%)]"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Agency Info" && <AgencyInfoTab />}
      {activeTab === "Team" && <TeamTab />}
      {activeTab === "Audit Log" && <AuditLogTab />}
    </div>
  );
}
