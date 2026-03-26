import { PortalTransactions } from "@/components/portal/portal-transactions";

export default function ClientTransactionsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Transactions</h1>
      <PortalTransactions />
    </div>
  );
}
