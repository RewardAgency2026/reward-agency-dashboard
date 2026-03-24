"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { SuppliersTable } from "@/components/suppliers/suppliers-table";
import { AddSupplierModal } from "@/components/suppliers/add-supplier-modal";

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

export default function SuppliersPage() {
  const { data: session } = useSession();
  const isAdmin = ["admin", "team"].includes(session?.user.role ?? "");

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => fetch("/api/suppliers").then((r) => r.json()),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
        {isAdmin && <AddSupplierModal />}
      </div>
      {isLoading ? (
        <TableSkeleton />
      ) : (
        <SuppliersTable suppliers={suppliers ?? []} isAdmin={isAdmin} />
      )}
    </div>
  );
}
