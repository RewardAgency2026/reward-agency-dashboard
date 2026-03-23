import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ClientTopNav } from "@/components/client-topnav";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) redirect("/login");
  if (session.user.userType !== "client") redirect("/login");

  return (
    <div className="min-h-screen bg-white">
      <ClientTopNav userName={session.user.name} />
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
