import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AgencySidebar } from "@/components/agency-sidebar";
import { Providers } from "@/components/providers";

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
    <Providers>
      <div className="flex min-h-screen bg-white">
        <AgencySidebar userName={session.user.name} userRole={session.user.role} />
        <main className="ml-60 flex-1 bg-white p-8">{children}</main>
      </div>
    </Providers>
  );
}
