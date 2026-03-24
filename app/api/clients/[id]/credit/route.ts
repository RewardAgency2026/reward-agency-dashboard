import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { clients, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { calculateWalletBalance } from "@/lib/balance";
import { logAudit } from "@/lib/audit";

const creditSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  currency: z.enum(["USD", "USDT", "USDC", "EUR"]),
  description: z.string().optional().default(""),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only admin and team can credit
  if (!["admin", "team"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = creditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.issues }, { status: 400 });
  }

  const { amount, currency, description } = parsed.data;

  // Fetch client to get crypto_fee_rate
  const [client] = await db
    .select({
      id: clients.id,
      name: clients.name,
      balance_model: clients.balance_model,
      crypto_fee_rate: clients.crypto_fee_rate,
    })
    .from(clients)
    .where(eq(clients.id, params.id))
    .limit(1);

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const isCrypto = currency === "USDT" || currency === "USDC";
  const grossAmount = amount;
  const cryptoFeeRate = parseFloat(client.crypto_fee_rate);

  let cryptoFeeAmount = 0;
  let netAmount = grossAmount;

  if (isCrypto) {
    cryptoFeeAmount = Math.round(grossAmount * (cryptoFeeRate / 100) * 100) / 100;
    netAmount = Math.round((grossAmount - cryptoFeeAmount) * 100) / 100;
  }

  const [txn] = await db
    .insert(transactions)
    .values({
      client_id: params.id,
      type: "payment",
      amount: String(netAmount),
      currency,
      is_crypto: isCrypto,
      crypto_fee_amount: String(cryptoFeeAmount),
      description: description || null,
      created_by: session.user.id,
    })
    .returning();

  const wallet_balance = await calculateWalletBalance(client.id, client.balance_model);

  logAudit({
    userId: session.user.id,
    userName: session.user.name ?? session.user.email ?? "Unknown",
    action: "balance_credited",
    details: {
      client_id: params.id,
      client_name: client.name,
      amount: netAmount,
      currency,
      is_crypto: isCrypto,
      crypto_fee: cryptoFeeAmount,
      description: description || null,
    },
  });

  return NextResponse.json({ transaction: txn, wallet_balance }, { status: 201 });
}
