import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ClientTopNav } from "@/components/client-topnav";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) redirect("/login");
  if (session.user.userType !== "client") redirect("/login");

  const [clientData] = await db
    .select({ client_code: clients.client_code })
    .from(clients)
    .where(eq(clients.id, session.user.id))
    .limit(1);

  return (
    <div className="min-h-screen bg-gray-50">
      <ClientTopNav
        userName={session.user.name ?? ""}
        clientCode={clientData?.client_code ?? ""}
      />
      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
