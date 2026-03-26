import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ClientSidebar } from "@/components/client-sidebar";
import { Providers } from "@/components/providers";

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
    <Providers>
      <div className="flex min-h-screen bg-white">
        <ClientSidebar
          userName={session.user.name ?? ""}
          clientCode={clientData?.client_code ?? ""}
        />
        <main className="ml-60 flex-1 bg-gray-50 p-8">{children}</main>
      </div>
    </Providers>
  );
}
