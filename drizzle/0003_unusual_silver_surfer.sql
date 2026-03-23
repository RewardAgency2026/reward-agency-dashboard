CREATE TABLE "supplier_sub_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplier_platform_fees" DROP CONSTRAINT "uniq_supplier_platform";
--> statement-breakpoint
ALTER TABLE "supplier_platform_fees" ALTER COLUMN "supplier_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD COLUMN "supplier_sub_account_id" uuid;
--> statement-breakpoint
-- Add as nullable first so existing rows don't violate NOT NULL
ALTER TABLE "supplier_platform_fees" ADD COLUMN "supplier_sub_account_id" uuid;
--> statement-breakpoint
-- Back-fill: for each supplier that has existing fee rows, create a default
-- sub-account and link all its fees to it. No-op if table is empty.
WITH new_sub AS (
  INSERT INTO supplier_sub_accounts (supplier_id, name, status)
  SELECT DISTINCT spf.supplier_id, s.name || ' (Default)', 'active'
  FROM supplier_platform_fees spf
  JOIN suppliers s ON s.id = spf.supplier_id
  RETURNING id, supplier_id
)
UPDATE supplier_platform_fees spf
SET supplier_sub_account_id = new_sub.id, supplier_id = new_sub.supplier_id
FROM new_sub
WHERE new_sub.supplier_id = spf.supplier_id;
--> statement-breakpoint
-- Now safe to enforce NOT NULL (all existing rows are back-filled)
ALTER TABLE "supplier_platform_fees" ALTER COLUMN "supplier_sub_account_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "supplier_sub_accounts" ADD CONSTRAINT "supplier_sub_accounts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_supplier_sub_account_id_supplier_sub_accounts_id_fk" FOREIGN KEY ("supplier_sub_account_id") REFERENCES "public"."supplier_sub_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "supplier_platform_fees" ADD CONSTRAINT "supplier_platform_fees_supplier_sub_account_id_supplier_sub_accounts_id_fk" FOREIGN KEY ("supplier_sub_account_id") REFERENCES "public"."supplier_sub_accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "supplier_platform_fees" ADD CONSTRAINT "uniq_sub_account_platform" UNIQUE("supplier_sub_account_id","platform");
