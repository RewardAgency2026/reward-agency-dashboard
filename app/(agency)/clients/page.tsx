import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { clients, affiliates, transactions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { ClientsTable } from "@/components/clients/clients-table";
import { calculateWalletBalances, balanceFromData } from "@/lib/balance";

export default async function ClientsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [rows, affiliateList] = await Promise.all([
    db
      .select({
        id: clients.id,
        client_code: clients.client_code,
        name: clients.name,
        email: clients.email,
        company: clients.company,
        status: clients.status,
        balance_model: clients.balance_model,
        billing_currency: clients.billing_currency,
        crypto_fee_rate: clients.crypto_fee_rate,
        affiliate_id: clients.affiliate_id,
        affiliate_name: affiliates.name,
        created_at: clients.created_at,
      })
      .from(clients)
      .leftJoin(affiliates, eq(clients.affiliate_id, affiliates.id))
      .orderBy(desc(clients.created_at)),

    db
      .select({ id: affiliates.id, name: affiliates.name, affiliate_code: affiliates.affiliate_code })
      .from(affiliates)
      .where(eq(affiliates.status, "active")),
  ]);

  const balanceMap = await calculateWalletBalances(rows.map((r) => r.id));

  const data = rows.map((c) => ({
    ...c,
    created_at: c.created_at.toISOString(),
    wallet_balance: balanceFromData(balanceMap.get(c.id), c.balance_model),
  }));

  const isAdmin = session.user.role === "admin";

  return <ClientsTable clients={data} affiliates={affiliateList} isAdmin={isAdmin} />;
}
