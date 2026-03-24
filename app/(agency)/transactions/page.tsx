"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TransactionsTable } from "@/components/transactions/transactions-table";

export default function TransactionsPage() {
  const [typeFilter, setTypeFilter] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const params = new URLSearchParams();
  if (typeFilter) params.set("type", typeFilter);
  if (currencyFilter) params.set("currency", currencyFilter);
  if (search) params.set("search", search);
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions", typeFilter, currencyFilter, search, dateFrom, dateTo],
    queryFn: () => fetch(`/api/transactions?${params}`).then((r) => r.json()),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
      </div>
      <TransactionsTable
        transactions={transactions ?? []}
        isLoading={isLoading}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        currencyFilter={currencyFilter}
        setCurrencyFilter={setCurrencyFilter}
        search={search}
        setSearch={setSearch}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
      />
    </div>
  );
}
