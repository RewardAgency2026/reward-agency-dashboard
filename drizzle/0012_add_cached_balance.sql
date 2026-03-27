ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "cached_balance" numeric(12,2),
  ADD COLUMN IF NOT EXISTS "balance_updated_at" timestamptz;
