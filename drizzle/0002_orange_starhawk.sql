ALTER TABLE "clients" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "has_setup" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "setup_monthly_fee" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "setup_monthly_cost" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "client_platform_fees" jsonb;