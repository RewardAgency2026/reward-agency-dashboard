"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AffiliatesTable, type AffiliateRow } from "@/components/affiliates/affiliates-table";
import { AddAffiliateModal } from "@/components/affiliates/add-affiliate-modal";

export default function AffiliatesPage() {
  const [showAdd, setShowAdd] = useState(false);
  const queryClient = useQueryClient();

  const { data: affiliates = [], isLoading } = useQuery<AffiliateRow[]>({
    queryKey: ["affiliates"],
    queryFn: () => fetch("/api/affiliates").then((r) => r.json()),
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Affiliates</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage affiliate partners and commissions</p>
      </div>

      <AffiliatesTable
        affiliates={affiliates}
        isLoading={isLoading}
        onAdd={() => setShowAdd(true)}
      />

      {showAdd && (
        <AddAffiliateModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            queryClient.invalidateQueries({ queryKey: ["affiliates"] });
          }}
        />
      )}
    </div>
  );
}
