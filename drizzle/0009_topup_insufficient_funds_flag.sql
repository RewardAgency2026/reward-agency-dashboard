-- Migration: replace status=approved/insufficient_funds with insufficient_funds boolean flag
-- Add insufficient_funds column
ALTER TABLE "topup_requests" ADD COLUMN "insufficient_funds" boolean NOT NULL DEFAULT false;

-- Migrate existing data
UPDATE "topup_requests" SET "status" = 'pending', "insufficient_funds" = false WHERE "status" = 'approved';
UPDATE "topup_requests" SET "status" = 'pending', "insufficient_funds" = true WHERE "status" = 'insufficient_funds';
