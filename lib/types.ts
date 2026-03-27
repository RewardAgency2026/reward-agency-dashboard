import { transactions } from "@/db/schema";

// Full transaction as returned by Drizzle
export type FullTransaction = typeof transactions.$inferSelect;

/**
 * Transaction type safe for client-facing and affiliate-facing API responses.
 * Omits all internal fee fields that must never be exposed outside the agency.
 *
 * Confidential fields:
 *   - supplier_fee_amount      — what the agency pays the supplier
 *   - supplier_fee_rate_snapshot — snapshot of supplier fee rate at execution time
 *   - top_up_fee_amount        — internal commission charged to the client
 *   - crypto_fee_amount        — internal crypto processing fee
 */
export type ClientSafeTransaction = Omit<
  FullTransaction,
  "supplier_fee_amount" | "top_up_fee_amount" | "crypto_fee_amount" | "supplier_fee_rate_snapshot"
>;

/**
 * Strip all confidential fee fields from a transaction row.
 * Use this in any API route that returns transactions to clients or affiliates.
 */
export function toClientSafeTransaction(txn: FullTransaction): ClientSafeTransaction {
  const {
    supplier_fee_amount: _s,
    top_up_fee_amount: _t,
    crypto_fee_amount: _c,
    supplier_fee_rate_snapshot: _sr,
    ...safe
  } = txn;
  void _s; void _t; void _c; void _sr;
  return safe;
}

// The four field names that must never appear in client/affiliate responses
export const CONFIDENTIAL_TRANSACTION_FIELDS = [
  "supplier_fee_amount",
  "top_up_fee_amount",
  "crypto_fee_amount",
  "supplier_fee_rate_snapshot",
] as const;
