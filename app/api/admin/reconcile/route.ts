import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { updateBalanceCache } from "@/lib/balance";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const allClients = await db.select({ id: clients.id, balance_model: clients.balance_model }).from(clients);

  let updated = 0;
  for (const client of allClients) {
    try {
      await updateBalanceCache(client.id, client.balance_model);
      updated++;
    } catch (err) {
      console.error(`[reconcile] Failed for client ${client.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, updated, total: allClients.length });
}
