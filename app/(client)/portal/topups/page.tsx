import { PortalTopups } from "@/components/portal/portal-topups";

export default function ClientTopUpsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Top Ups</h1>
      </div>
      <PortalTopups />
    </div>
  );
}
