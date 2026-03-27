import { db } from "@/db";
import { clients, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { updateBalanceCache } from "@/lib/balance";
import { logAudit } from "@/lib/audit";

type Currency = "USD" | "USDT" | "USDC" | "EUR";

export interface CreditParams {
  clientId: string;
  amount: number;
  currency: Currency;
  description?: string;
  createdBy: string;
  createdByName: string;
}

export interface DebitParams {
  clientId: string;
  amount: number;
  type: "withdraw" | "refund";
  currency: Currency;
  description?: string;
  adAccountId?: string;
  supplierId?: string;
  createdBy: string;
  createdByName: string;
}

export async function creditWallet({ clientId, amount, currency, description, createdBy, createdByName }: CreditParams) {
  const [client] = await db
    .select({ id: clients.id, name: clients.name, balance_model: clients.balance_model, crypto_fee_rate: clients.crypto_fee_rate })
    .from(clients).where(eq(clients.id, clientId)).limit(1);

  if (!client) throw new Error("Client not found");

  const isCrypto = currency === "USDT" || currency === "USDC";
  const cryptoFeeRate = parseFloat(client.crypto_fee_rate);
  const cryptoFeeAmount = isCrypto ? Math.round(amount * (cryptoFeeRate / 100) * 100) / 100 : 0;
  const netAmount = isCrypto ? Math.round((amount - cryptoFeeAmount) * 100) / 100 : amount;

  const [txn] = await db.insert(transactions).values({
    client_id: clientId,
    type: "payment",
    amount: String(netAmount),
    currency,
    is_crypto: isCrypto,
    crypto_fee_amount: String(cryptoFeeAmount),
    description: description || null,
    created_by: createdBy,
  }).returning();

  const wallet_balance = await updateBalanceCache(client.id, client.balance_model);

  await logAudit({
    userId: createdBy,
    userName: createdByName,
    action: "balance_credited",
    details: { client_id: clientId, client_name: client.name, amount: netAmount, currency, is_crypto: isCrypto, crypto_fee: cryptoFeeAmount, description: description || null },
  });

  return { transaction: txn, wallet_balance };
}

export async function debitWallet({ clientId, amount, type, currency, description, adAccountId, supplierId, createdBy, createdByName }: DebitParams) {
  const [client] = await db
    .select({ id: clients.id, name: clients.name, balance_model: clients.balance_model })
    .from(clients).where(eq(clients.id, clientId)).limit(1);

  if (!client) throw new Error("Client not found");

  const [txn] = await db.insert(transactions).values({
    client_id: clientId,
    ad_account_id: adAccountId ?? null,
    supplier_id: supplierId ?? null,
    type,
    amount: String(amount),
    currency,
    is_crypto: false,
    description: description || null,
    created_by: createdBy,
  }).returning();

  const wallet_balance = await updateBalanceCache(client.id, client.balance_model);

  await logAudit({
    userId: createdBy,
    userName: createdByName,
    action: "balance_withdrawn",
    details: { client_id: clientId, client_name: client.name, amount, currency, description: description || null },
  });

  return { transaction: txn, wallet_balance };
}
