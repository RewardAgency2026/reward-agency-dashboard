import { AffiliateTabs } from "@/components/affiliates/affiliate-tabs";

interface Props {
  params: { id: string };
}

export default function AffiliateDetailPage({ params }: Props) {
  return (
    <div className="p-6">
      <AffiliateTabs affiliateId={params.id} />
    </div>
  );
}
