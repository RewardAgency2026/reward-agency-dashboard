"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { ClientsTable } from "@/components/clients/clients-table";

function TableSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} className="animate-pulse">
              {Array.from({ length: 5 }).map((_, j) => (
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

export default function ClientsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "admin";

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetch("/api/clients").then((r) => r.json()),
  });

  const { data: affiliates = [] } = useQuery({
    queryKey: ["affiliates"],
    queryFn: () => fetch("/api/affiliates").then((r) => r.json()),
  });

  return (
    <div>
      {clientsLoading ? (
        <TableSkeleton />
      ) : (
        <ClientsTable clients={clients ?? []} affiliates={affiliates} isAdmin={isAdmin} />
      )}
    </div>
  );
}
