ALTER TABLE "affiliate_commissions" DROP CONSTRAINT "uniq_affiliate_period";--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ALTER COLUMN "status" SET DEFAULT 'preview';--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "uniq_affiliate_period_preview" UNIQUE("affiliate_id","period_year","period_month","status");