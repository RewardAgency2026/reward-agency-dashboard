"use client";

import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { SupplierTabs } from "@/components/suppliers/supplier-tabs";

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 bg-gray-100 rounded w-64" />
      <div className="h-4 bg-gray-100 rounded w-48" />
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-100 rounded w-full" />
        ))}
      </div>
    </div>
  );
}

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: session } = useSession();
  const isAdmin = ["admin", "team"].includes(session?.user.role ?? "");

  const { data: supplier, isLoading } = useQuery({
    queryKey: ["suppliers", id],
    queryFn: () => fetch(`/api/suppliers/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  if (isLoading || !supplier) {
    return <PageSkeleton />;
  }

  return <SupplierTabs supplier={supplier} isAdmin={isAdmin} />;
}
