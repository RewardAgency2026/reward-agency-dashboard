import { db } from "@/db";
import { transactions } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";

/** Calculate wallet balance for a single client */
export async function calculateWalletBalance(
  clientId: string,
  balanceModel: string
): Promise<number> {
  const [row] = await db
    .select({
      payments: sql<string>`COALESCE(SUM(CASE WHEN type = 'payment' THEN amount::numeric ELSE 0 END), 0)`,
      classic_out: sql<string>`COALESCE(SUM(CASE WHEN type IN ('topup','withdraw','refund') THEN amount::numeric ELSE 0 END), 0)`,
      spends: sql<string>`COALESCE(SUM(CASE WHEN type = 'spend_record' THEN amount::numeric ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.client_id, clientId));

  const payments = parseFloat(row?.payments ?? "0");
  if (balanceModel === "classic") {
    return payments - parseFloat(row?.classic_out ?? "0");
  }
  return payments - parseFloat(row?.spends ?? "0");
}

/** Efficiently batch-calculate balances for multiple clients */
export async function calculateWalletBalances(
  clientIds: string[]
): Promise<Map<string, { payments: number; classic_out: number; spends: number }>> {
  if (clientIds.length === 0) return new Map();

  const rows = await db
    .select({
      client_id: transactions.client_id,
      payments: sql<string>`COALESCE(SUM(CASE WHEN type = 'payment' THEN amount::numeric ELSE 0 END), 0)`,
      classic_out: sql<string>`COALESCE(SUM(CASE WHEN type IN ('topup','withdraw','refund') THEN amount::numeric ELSE 0 END), 0)`,
      spends: sql<string>`COALESCE(SUM(CASE WHEN type = 'spend_record' THEN amount::numeric ELSE 0 END), 0)`,
    })
    .from(transactions)
    .where(inArray(transactions.client_id, clientIds))
    .groupBy(transactions.client_id);

  const map = new Map<string, { payments: number; classic_out: number; spends: number }>();
  for (const r of rows) {
    map.set(r.client_id, {
      payments: parseFloat(r.payments),
      classic_out: parseFloat(r.classic_out),
      spends: parseFloat(r.spends),
    });
  }
  return map;
}

export function balanceFromData(
  data: { payments: number; classic_out: number; spends: number } | undefined,
  balanceModel: string
): number {
  if (!data) return 0;
  return balanceModel === "classic"
    ? data.payments - data.classic_out
    : data.payments - data.spends;
}
