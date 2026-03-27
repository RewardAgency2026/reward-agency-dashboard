/**
 * Sprint 10 — Ad Account Withdrawal integration tests
 * Covers POST /api/ad-accounts/[id]/withdraw
 * Requires dev server at http://localhost:3000
 * Run: npx tsx --test tests/sprint10-withdrawals.test.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { encode } from "next-auth/jwt";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and } from "drizzle-orm";
import { users, affiliates, clients, suppliers, ad_accounts, transactions } from "../db/schema";

const BASE = "http://localhost:3000";
const COOKIE_NAME = "authjs.session-token";
const SALT = COOKIE_NAME;

let adminCookie = "";
let teamCookie = "";
let accountantCookie = "";
let affiliateCookie = "";

// Test fixtures — created in before(), cleaned up in after()
let testClientId = "";
let testSupplierId = "";
let testAdAccountId = "";

// ── Auth helpers ──────────────────────────────────────────────────────────────
async function setupCookies() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  // Admin
  const [admin] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.email, "admin@reward-agency.com"), eq(users.role, "admin")))
    .limit(1);

  if (!admin) throw new Error("Admin user not found — run db:seed first");

  const adminToken = await encode({
    token: {
      sub: admin.id,
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      userType: "agency",
    },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: SALT,
  });
  adminCookie = `${COOKIE_NAME}=${adminToken}`;

  // Team
  const [team] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.email, "team@reward-agency.com"), eq(users.role, "team")))
    .limit(1);

  if (!team) throw new Error("Team user not found — run db:seed first");

  const teamToken = await encode({
    token: {
      sub: team.id,
      id: team.id,
      name: team.name,
      email: team.email,
      role: team.role,
      userType: "agency",
    },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: SALT,
  });
  teamCookie = `${COOKIE_NAME}=${teamToken}`;

  // Accountant
  const [accountant] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.email, "accountant@reward-agency.com"), eq(users.role, "accountant")))
    .limit(1);

  if (!accountant) throw new Error("Accountant user not found — run db:seed first");

  const accountantToken = await encode({
    token: {
      sub: accountant.id,
      id: accountant.id,
      name: accountant.name,
      email: accountant.email,
      role: accountant.role,
      userType: "agency",
    },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: SALT,
  });
  accountantCookie = `${COOKIE_NAME}=${accountantToken}`;

  // Affiliate
  const [affiliate] = await db
    .select({ id: affiliates.id, name: affiliates.name, email: affiliates.email })
    .from(affiliates)
    .where(eq(affiliates.email, "affiliate@reward-agency.com"))
    .limit(1);

  if (!affiliate) throw new Error("Test affiliate not found — run db:seed first");

  const affiliateToken = await encode({
    token: {
      sub: affiliate.id,
      id: affiliate.id,
      name: affiliate.name,
      email: affiliate.email,
      role: "affiliate",
      userType: "affiliate",
    },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: SALT,
  });
  affiliateCookie = `${COOKIE_NAME}=${affiliateToken}`;
}

// ── Fixture setup ─────────────────────────────────────────────────────────────
async function setupFixtures() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  // Create a test supplier
  const [supplier] = await db
    .insert(suppliers)
    .values({
      name: "Test Supplier — Withdrawal Tests",
      contact_email: "withdrawal-test-supplier@test.internal",
      status: "active",
    })
    .returning({ id: suppliers.id });
  testSupplierId = supplier.id;

  // Create a test client (classic model, no affiliate)
  const [client] = await db
    .insert(clients)
    .values({
      client_code: "RWD-9997",
      name: "Test Client — Withdrawal Tests",
      email: "withdrawal-test-client@test.internal",
      company: "Test Co",
      balance_model: "classic",
      billing_currency: "USD",
      status: "active",
    })
    .returning({ id: clients.id });
  testClientId = client.id;

  // Create a test ad account linked to that client + supplier
  const [adAccount] = await db
    .insert(ad_accounts)
    .values({
      client_id: testClientId,
      supplier_id: testSupplierId,
      platform: "meta",
      account_id: "ACT_WITHDRAWAL_TEST",
      account_name: "Withdrawal Test Ad Account",
      top_up_fee_rate: "5.00",
      status: "active",
    })
    .returning({ id: ad_accounts.id });
  testAdAccountId = adAccount.id;
}

// ── Request helper ────────────────────────────────────────────────────────────
async function api(method: string, path: string, cookie: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
async function cleanup() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  // Delete transactions created during tests (cascade won't cover them since
  // ad_account_id is set null on delete, so we clean them up first via client_id)
  if (testClientId) {
    await db.delete(transactions).where(eq(transactions.client_id, testClientId));
  }
  if (testAdAccountId) {
    await db.delete(ad_accounts).where(eq(ad_accounts.id, testAdAccountId));
  }
  if (testClientId) {
    await db.delete(clients).where(eq(clients.id, testClientId));
  }
  if (testSupplierId) {
    await db.delete(suppliers).where(eq(suppliers.id, testSupplierId));
  }
}

// ── Test suite ────────────────────────────────────────────────────────────────
describe("Sprint 10 — Ad Account Withdrawal", () => {
  before(async () => {
    await setupCookies();
    await setupFixtures();
  });

  after(cleanup);

  const NON_EXISTENT_ID = "00000000-0000-0000-0000-000000000000";
  const validBody = { amount: 100, currency: "USD" };

  // ── Auth / role guards ────────────────────────────────────────────────────
  describe("POST /api/ad-accounts/[id]/withdraw — auth & role guards", () => {
    it("returns 401 for unauthenticated request", async () => {
      const res = await fetch(`${BASE}/api/ad-accounts/${NON_EXISTENT_ID}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });
      assert.equal(res.status, 401);
    });

    it("returns 403 for affiliate role", async () => {
      const { status } = await api(
        "POST",
        `/api/ad-accounts/${testAdAccountId}/withdraw`,
        affiliateCookie,
        validBody
      );
      assert.equal(status, 403);
    });

    it("returns 403 for accountant role", async () => {
      const { status } = await api(
        "POST",
        `/api/ad-accounts/${testAdAccountId}/withdraw`,
        accountantCookie,
        validBody
      );
      assert.equal(status, 403);
    });
  });

  // ── Validation ────────────────────────────────────────────────────────────
  describe("POST /api/ad-accounts/[id]/withdraw — request validation", () => {
    it("returns 400 when body is missing required fields", async () => {
      const { status } = await api(
        "POST",
        `/api/ad-accounts/${testAdAccountId}/withdraw`,
        adminCookie,
        {}
      );
      assert.equal(status, 400);
    });

    it("returns 400 when amount is zero", async () => {
      const { status } = await api(
        "POST",
        `/api/ad-accounts/${testAdAccountId}/withdraw`,
        adminCookie,
        { amount: 0, currency: "USD" }
      );
      assert.equal(status, 400);
    });

    it("returns 400 when amount is negative", async () => {
      const { status } = await api(
        "POST",
        `/api/ad-accounts/${testAdAccountId}/withdraw`,
        adminCookie,
        { amount: -50, currency: "USD" }
      );
      assert.equal(status, 400);
    });

    it("returns 400 when currency is invalid", async () => {
      const { status } = await api(
        "POST",
        `/api/ad-accounts/${testAdAccountId}/withdraw`,
        adminCookie,
        { amount: 100, currency: "GBP" }
      );
      assert.equal(status, 400);
    });

    it("returns 400 when update_status is invalid", async () => {
      const { status } = await api(
        "POST",
        `/api/ad-accounts/${testAdAccountId}/withdraw`,
        adminCookie,
        { amount: 100, currency: "USD", update_status: "closed" }
      );
      assert.equal(status, 400);
    });
  });

  // ── Not found ─────────────────────────────────────────────────────────────
  describe("POST /api/ad-accounts/[id]/withdraw — not found", () => {
    it("returns 404 for non-existent ad account ID", async () => {
      const { status } = await api(
        "POST",
        `/api/ad-accounts/${NON_EXISTENT_ID}/withdraw`,
        adminCookie,
        validBody
      );
      assert.equal(status, 404);
    });
  });

  // ── Success — admin ───────────────────────────────────────────────────────
  describe("POST /api/ad-accounts/[id]/withdraw — success", () => {
    it("returns 200 with correct response shape for admin role", async () => {
      const { status, data } = await api(
        "POST",
        `/api/ad-accounts/${testAdAccountId}/withdraw`,
        adminCookie,
        { amount: 200, currency: "USD", notes: "Test withdrawal" }
      );
      assert.equal(status, 200);
      assert.ok("withdrawal_amount" in data, "response should have withdrawal_amount");
      assert.ok("commission_refund" in data, "response should have commission_refund");
      assert.ok("provider_fee_refund" in data, "response should have provider_fee_refund");
      assert.ok("total_credited_to_client" in data, "response should have total_credited_to_client");
      assert.ok("new_wallet_balance" in data, "response should have new_wallet_balance");
      assert.ok("ad_account_status" in data, "response should have ad_account_status");
      assert.equal(data.withdrawal_amount, 200);
      assert.ok(
        data.total_credited_to_client >= data.withdrawal_amount,
        "total_credited_to_client should be >= withdrawal_amount (includes commission refund)"
      );
    });

    it("returns 200 with correct response shape for team role", async () => {
      const { status, data } = await api(
        "POST",
        `/api/ad-accounts/${testAdAccountId}/withdraw`,
        teamCookie,
        { amount: 50, currency: "USD" }
      );
      assert.equal(status, 200);
      assert.ok("withdrawal_amount" in data, "response should have withdrawal_amount");
      assert.ok("commission_refund" in data, "response should have commission_refund");
      assert.ok("total_credited_to_client" in data, "response should have total_credited_to_client");
      assert.ok("new_wallet_balance" in data, "response should have new_wallet_balance");
    });

    it("updates ad account status to disabled when update_status=disabled", async () => {
      const { status, data } = await api(
        "POST",
        `/api/ad-accounts/${testAdAccountId}/withdraw`,
        adminCookie,
        { amount: 10, currency: "USD", update_status: "disabled" }
      );
      assert.equal(status, 200);
      assert.equal(data.ad_account_status, "disabled");

      // Restore status for subsequent tests
      const sql = neon(process.env.DATABASE_URL!);
      const db = drizzle(sql);
      await db
        .update(ad_accounts)
        .set({ status: "active" })
        .where(eq(ad_accounts.id, testAdAccountId));
    });

    it("does not expose supplier_fee_amount in response", async () => {
      const { status, data } = await api(
        "POST",
        `/api/ad-accounts/${testAdAccountId}/withdraw`,
        adminCookie,
        { amount: 10, currency: "USD" }
      );
      assert.equal(status, 200);
      assert.ok(!("supplier_fee_amount" in data), "supplier_fee_amount must not be in response");
      assert.ok(!("supplier_fee_rate_snapshot" in data), "supplier_fee_rate_snapshot must not be in response");
    });
  });
});
