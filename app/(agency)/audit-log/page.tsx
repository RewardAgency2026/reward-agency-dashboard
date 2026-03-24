"use client";

import { useQuery } from "@tanstack/react-query";
import { AuditLogTable } from "@/components/audit-log/audit-log-table";

function TableSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i} className="animate-pulse">
              {Array.from({ length: 4 }).map((_, j) => (
                <td key={j} className="px-4 py-3">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AuditLogPage() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => fetch("/api/audit-logs").then((r) => r.json()),
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">All sensitive actions tracked in real-time</p>
      </div>
      {isLoading ? (
        <TableSkeleton />
      ) : (
        <AuditLogTable logs={logs ?? []} />
      )}
    </div>
  );
}
