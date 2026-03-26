import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { ad_accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cn } from "@/lib/utils";
import { PlatformIcon } from "@/components/ui/platform-icon";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  disabled: "bg-red-50 text-red-600 border border-red-200",
  deleted: "bg-gray-100 text-gray-400 border border-gray-200",
};

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta",
  google: "Google",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  linkedin: "LinkedIn",
};

export default async function ClientAccountsPage() {
  const session = await auth();
  if (!session || session.user.userType !== "client") redirect("/login");

  const clientId = session.user.id;

  const accounts = await db
    .select({
      id: ad_accounts.id,
      platform: ad_accounts.platform,
      account_id: ad_accounts.account_id,
      account_name: ad_accounts.account_name,
      status: ad_accounts.status,
      created_at: ad_accounts.created_at,
    })
    .from(ad_accounts)
    .where(eq(ad_accounts.client_id, clientId));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">My Ad Accounts</h1>

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
          <p className="text-sm text-gray-500">No ad accounts yet.</p>
          <p className="text-xs text-gray-400 mt-1">Contact your account manager to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((a) => (
            <div key={a.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PlatformIcon platform={a.platform} size={22} />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{a.account_name}</p>
                    <p className="text-xs text-gray-400 capitalize">{PLATFORM_LABELS[a.platform] ?? a.platform}</p>
                  </div>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", STATUS_BADGE[a.status] ?? "bg-gray-100 text-gray-500")}>
                  {a.status}
                </span>
              </div>
              <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                <p className="text-xs text-gray-400 mb-0.5">Account ID</p>
                <p className="font-mono text-xs text-gray-700 break-all">{a.account_id}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
