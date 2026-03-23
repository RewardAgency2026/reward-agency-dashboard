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
    <div className="min-h-screen" style={{ paddingLeft: "var(--sidebar-width)" }}>
      <AffiliateSidebar userName={session.user.name} />
      <main className="min-h-screen p-8">{children}</main>
    </div>
  );
}
