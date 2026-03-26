import {
  pgTable,
  uuid,
  text,
  numeric,
  boolean,
  integer,
  timestamp,
  date,
  unique,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const now = () => sql<Date>`now()`;

// ─── affiliates (referenced by clients, so must come first) ───────────────────
export const affiliates = pgTable("affiliates", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  affiliate_code: text("affiliate_code").notNull().unique(), // AFF-0001
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  company: text("company").notNull(),
  billing_address: text("billing_address"),
  billing_vat: text("billing_vat"),
  commission_rate: numeric("commission_rate", { precision: 5, scale: 2 }).notNull(),
  referral_link: text("referral_link"),
  password_hash: text("password_hash"), // nullable: set when affiliate activates their account
  status: text("status").notNull().default("active"), // active|inactive
  created_at: timestamp("created_at").notNull().default(now()),
});

// ─── users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password_hash: text("password_hash").notNull(),
  role: text("role").notNull(), // admin|team|accountant
  created_at: timestamp("created_at").notNull().default(now()),
});

// ─── clients ─────────────────────────────────────────────────────────────────
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  client_code: text("client_code").notNull().unique(), // RWD-0001
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  company: text("company").notNull(),
  balance_model: text("balance_model").notNull().default("classic"), // classic|dynamic
  crypto_fee_rate: numeric("crypto_fee_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  billing_currency: text("billing_currency").notNull().default("USD"), // USD|EUR
  status: text("status").notNull().default("active"), // active|paused|churned
  affiliate_id: uuid("affiliate_id").references(() => affiliates.id, { onDelete: "set null" }),
  onboarding_source: text("onboarding_source").notNull().default("manual"), // manual|affiliate_link
  notes: text("notes"),
  has_setup: boolean("has_setup").notNull().default(false),
  setup_monthly_fee: numeric("setup_monthly_fee", { precision: 10, scale: 2 }),
  setup_monthly_cost: numeric("setup_monthly_cost", { precision: 10, scale: 2 }),
  client_platform_fees: jsonb("client_platform_fees").$type<{ meta: number; google: number; tiktok: number; snapchat: number; linkedin: number } | null>(),
  password_hash: text("password_hash"), // nullable: set via onboarding
  created_at: timestamp("created_at").notNull().default(now()),
});

// ─── suppliers ────────────────────────────────────────────────────────────────
export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  contact_email: text("contact_email"),
  status: text("status").notNull().default("active"), // active|inactive
  created_at: timestamp("created_at").notNull().default(now()),
});

// ─── supplier_sub_accounts ────────────────────────────────────────────────────
export const supplier_sub_accounts = pgTable("supplier_sub_accounts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  supplier_id: uuid("supplier_id")
    .notNull()
    .references(() => suppliers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"), // active|inactive
  created_at: timestamp("created_at").notNull().default(now()),
});

// ─── supplier_platform_fees ───────────────────────────────────────────────────
export const supplier_platform_fees = pgTable(
  "supplier_platform_fees",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    supplier_id: uuid("supplier_id")
      .references(() => suppliers.id, { onDelete: "cascade" }), // nullable — denormalized from sub-account
    supplier_sub_account_id: uuid("supplier_sub_account_id")
      .notNull()
      .references(() => supplier_sub_accounts.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(), // meta|google|tiktok|snapchat|linkedin
    fee_rate: numeric("fee_rate", { precision: 5, scale: 2 }).notNull(),
  },
  (t) => ({
    uniq_sub_account_platform: unique("uniq_sub_account_platform").on(t.supplier_sub_account_id, t.platform),
  })
);

// ─── ad_accounts ──────────────────────────────────────────────────────────────
export const ad_accounts = pgTable("ad_accounts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  client_id: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  supplier_id: uuid("supplier_id")
    .notNull()
    .references(() => suppliers.id, { onDelete: "restrict" }),
  supplier_sub_account_id: uuid("supplier_sub_account_id")
    .references(() => supplier_sub_accounts.id, { onDelete: "set null" }),
  platform: text("platform").notNull(), // meta|google|tiktok|snapchat|linkedin
  account_id: text("account_id").notNull(),
  account_name: text("account_name").notNull(),
  top_up_fee_rate: numeric("top_up_fee_rate", { precision: 5, scale: 2 }).notNull(),
  status: text("status").notNull().default("active"), // active|disabled|deleted
  created_at: timestamp("created_at").notNull().default(now()),
});

// ─── transactions ─────────────────────────────────────────────────────────────
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  client_id: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "restrict" }),
  ad_account_id: uuid("ad_account_id").references(() => ad_accounts.id, { onDelete: "set null" }),
  supplier_id: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
  type: text("type").notNull(), // payment|topup|withdraw|refund|spend_record|commission_fee
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"), // USD|USDT|USDC|EUR
  is_crypto: boolean("is_crypto").notNull().default(false),
  crypto_fee_amount: numeric("crypto_fee_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  supplier_fee_amount: numeric("supplier_fee_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  supplier_fee_rate_snapshot: numeric("supplier_fee_rate_snapshot", { precision: 5, scale: 2 }).notNull().default("0"),
  top_up_fee_amount: numeric("top_up_fee_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  description: text("description"),
  spend_date: date("spend_date"),
  created_by: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  created_at: timestamp("created_at").notNull().default(now()),
});

// ─── topup_requests ───────────────────────────────────────────────────────────
export const topup_requests = pgTable("topup_requests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  client_id: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  ad_account_id: uuid("ad_account_id")
    .notNull()
    .references(() => ad_accounts.id, { onDelete: "restrict" }),
  supplier_id: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("pending"), // pending|approved|insufficient_funds|executed|rejected
  notes: text("notes"),
  executed_by: uuid("executed_by").references(() => users.id, { onDelete: "set null" }),
  executed_at: timestamp("executed_at"),
  created_at: timestamp("created_at").notNull().default(now()),
});

// ─── invoices ─────────────────────────────────────────────────────────────────
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  client_id: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "restrict" }),
  invoice_number: text("invoice_number").notNull().unique(), // INV-YYYY-NNNN
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("draft"), // draft|sent|paid|overdue
  due_date: timestamp("due_date"),
  notes: text("notes"),
  created_at: timestamp("created_at").notNull().default(now()),
});

// ─── supplier_payments ────────────────────────────────────────────────────────
export const supplier_payments = pgTable("supplier_payments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  supplier_id: uuid("supplier_id")
    .notNull()
    .references(() => suppliers.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  bank_fees: numeric("bank_fees", { precision: 12, scale: 2 }).notNull().default("0"),
  bank_fees_note: text("bank_fees_note"),
  payment_method: text("payment_method"),
  reference: text("reference"),
  status: text("status").notNull().default("pending"), // pending|paid
  paid_at: timestamp("paid_at"),
  created_by: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  created_at: timestamp("created_at").notNull().default(now()),
});

// ─── affiliate_commissions ────────────────────────────────────────────────────
export const affiliate_commissions = pgTable(
  "affiliate_commissions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    affiliate_id: uuid("affiliate_id")
      .notNull()
      .references(() => affiliates.id, { onDelete: "cascade" }),
    period_year: integer("period_year").notNull(),
    period_month: integer("period_month").notNull(),
    clients_count: integer("clients_count").notNull().default(0),
    total_topups: numeric("total_topups", { precision: 12, scale: 2 }).notNull().default("0"),
    total_commissions_gross: numeric("total_commissions_gross", { precision: 12, scale: 2 }).notNull().default("0"),
    total_supplier_fees: numeric("total_supplier_fees", { precision: 12, scale: 2 }).notNull().default("0"),
    total_crypto_fees: numeric("total_crypto_fees", { precision: 12, scale: 2 }).notNull().default("0"),
    total_bank_fees: numeric("total_bank_fees", { precision: 12, scale: 2 }).notNull().default("0"),
    total_profit_net: numeric("total_profit_net", { precision: 12, scale: 2 }).notNull().default("0"),
    commission_rate: numeric("commission_rate", { precision: 5, scale: 2 }).notNull(),
    commission_amount: numeric("commission_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    status: text("status").notNull().default("preview"), // preview|calculated|paid
    pdf_url: text("pdf_url"),
    calculated_at: timestamp("calculated_at").notNull().default(now()),
    paid_at: timestamp("paid_at"),
  },
  (t) => ({
    uniq_affiliate_period_preview: unique("uniq_affiliate_period_preview").on(
      t.affiliate_id,
      t.period_year,
      t.period_month,
      t.status
    ),
  })
);

// ─── audit_logs ───────────────────────────────────────────────────────────────
export const audit_logs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  user_name: text("user_name").notNull(),
  action: text("action").notNull(), // topup_executed | topup_rejected | topup_deleted | balance_credited | balance_withdrawn
  details: jsonb("details").notNull().default(sql`'{}'::jsonb`),
  created_at: timestamp("created_at").notNull().default(now()),
});

// ─── settings ─────────────────────────────────────────────────────────────────
export const settings = pgTable("settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  agency_name: text("agency_name").notNull().default("Reward Agency"),
  agency_crypto_fee_rate: numeric("agency_crypto_fee_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  iban_usd: text("iban_usd"),
  iban_eur: text("iban_eur"),
  legal_mentions: text("legal_mentions"),
  from_email: text("from_email"),
  updated_at: timestamp("updated_at").notNull().default(now()),
});
