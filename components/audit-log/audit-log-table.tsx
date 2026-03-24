"use client";

import { cn } from "@/lib/utils";

interface AuditLog {
  id: string;
  user_name: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

interface Props {
  logs: AuditLog[];
}

const ACTION_LABELS: Record<string, string> = {
  topup_executed: "Top Up Executed",
  topup_rejected: "Top Up Rejected",
  topup_deleted: "Top Up Deleted",
  balance_credited: "Balance Credited",
  balance_withdrawn: "Balance Withdrawn",
};

const ACTION_BADGE: Record<string, string> = {
  topup_executed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  topup_rejected: "bg-gray-100 text-gray-600",
  topup_deleted: "bg-red-50 text-red-700 border border-red-200",
  balance_credited: "bg-blue-50 text-blue-700 border border-blue-200",
  balance_withdrawn: "bg-orange-50 text-orange-700 border border-orange-200",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function renderDetails(action: string, details: Record<string, unknown>): string {
  const parts: string[] = [];

  if (details.client_name) parts.push(`Client: ${details.client_name}`);
  if (details.amount) {
    const amt = typeof details.amount === "string" ? parseFloat(details.amount) : Number(details.amount);
    parts.push(`Amount: ${amt.toFixed(2)} ${details.currency ?? ""}`);
  }
  if (details.ad_account_platform) {
    const platform = String(details.ad_account_platform);
    parts.push(`Platform: ${platform.charAt(0).toUpperCase() + platform.slice(1)}`);
  }
  if (details.type) parts.push(`Type: ${details.type}`);
  if (details.previous_status) parts.push(`Was: ${details.previous_status}`);
  if (details.is_crypto) parts.push("Crypto payment");
  if (details.crypto_fee && Number(details.crypto_fee) > 0) parts.push(`Crypto fee: ${Number(details.crypto_fee).toFixed(2)}`);

  return parts.join(" · ");
}

export function AuditLogTable({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white">
        <p className="text-sm text-gray-400 text-center py-16">No audit log entries yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">User</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Action</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Details</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Date / Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-gray-50/50">
              <td className="px-4 py-3">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(236,85%,55%)] text-xs font-semibold text-white">
                  {log.user_name.charAt(0).toUpperCase()}
                </span>
                <span className="ml-2 font-medium text-gray-900">{log.user_name}</span>
              </td>
              <td className="px-4 py-3">
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", ACTION_BADGE[log.action] ?? "bg-gray-100 text-gray-600")}>
                  {ACTION_LABELS[log.action] ?? log.action}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600 text-xs">
                {renderDetails(log.action, log.details)}
              </td>
              <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap font-mono">
                {formatDateTime(log.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-gray-100 px-4 py-2">
        <p className="text-xs text-gray-400">Showing {logs.length} entries (most recent first)</p>
      </div>
    </div>
  );
}
