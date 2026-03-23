import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AffiliateSidebar } from "@/components/affiliate-sidebar";

export default async function AffiliateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) redirect("/login");
  if (session.user.userType !== "affiliate") redirect("/login");

  return (
    <div className="flex min-h-screen bg-[#f4f6f9]">
      <AffiliateSidebar userName={session.user.name} />
      <main className="ml-60 flex-1 p-8">{children}</main>
    </div>
  );
}
