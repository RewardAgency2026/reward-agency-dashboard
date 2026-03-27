import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { affiliates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AffiliateSidebar } from "@/components/affiliate-sidebar";
import { Providers } from "@/components/providers";

export default async function AffiliateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) redirect("/login");
  if (session.user.userType !== "affiliate") redirect("/login");

  const [affiliateRow] = await db
    .select({ affiliate_code: affiliates.affiliate_code })
    .from(affiliates)
    .where(eq(affiliates.id, session.user.id))
    .limit(1);

  return (
    <Providers>
      <div className="flex min-h-screen bg-white">
        <AffiliateSidebar
          userName={session.user.name}
          affiliateCode={affiliateRow?.affiliate_code ?? ""}
        />
        <main className="ml-60 flex-1 bg-white p-8">{children}</main>
      </div>
    </Providers>
  );
}
