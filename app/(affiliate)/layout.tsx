import { redirect } from "next/navigation";
import { auth } from "@/auth";
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

  return (
    <Providers>
      <div className="flex min-h-screen bg-white">
        <AffiliateSidebar userName={session.user.name} />
        <main className="ml-60 flex-1 bg-white p-8">{children}</main>
      </div>
    </Providers>
  );
}
