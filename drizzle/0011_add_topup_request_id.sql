-- FIX C1/C2: Add topup_request_id to transactions for idempotency
-- This ensures at most one transaction per topup request at the DB level.
-- NULL values are exempt from the unique constraint (PostgreSQL standard behaviour).

ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "topup_request_id" uuid REFERENCES "topup_requests"("id") ON DELETE SET NULL;

-- Partial unique index: enforces uniqueness only for non-NULL values
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_topup_request_txn"
  ON "transactions"("topup_request_id")
  WHERE "topup_request_id" IS NOT NULL;
