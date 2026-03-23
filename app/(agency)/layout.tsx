import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AgencySidebar } from "@/components/agency-sidebar";

const AGENCY_ROLES = ["admin", "team", "accountant"] as const;

export default async function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) redirect("/login");
  if (!AGENCY_ROLES.includes(session.user.role as (typeof AGENCY_ROLES)[number])) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen" style={{ paddingLeft: "var(--sidebar-width)" }}>
      <AgencySidebar userName={session.user.name} userRole={session.user.role} />
      <main className="min-h-screen p-8">{children}</main>
    </div>
  );
}
