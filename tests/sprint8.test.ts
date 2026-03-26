/**
 * Sprint 8 integration tests — Client Portal
 * Requires dev server at http://localhost:3000
 * Run: npm run test:sprint8
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { encode } from "next-auth/jwt";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and } from "drizzle-orm";
import {
  users, clients, transactions, ad_accounts, suppliers,
  supplier_sub_accounts, supplier_platform_fees, topup_requests,
} from "../db/schema";

const BASE = "http://localhost:3000";
const COOKIE_NAME = "authjs.session-token";

let adminCookie = "";
let clientCookie = "";
let client2Cookie = "";

let testClientId = "";
let testClient2Id = "";
let testAdAccountId = "";
let testSupplierId = "";
let testSubAccountId = "";

async function setupAuth() {
  const sql = neon(process.env.DATABASE_URL!);
  const db2 = drizzle(sql);

  // Admin cookie
  const [admin] = await db2.select().from(users).where(eq(users.email, "admin@reward-agency.com")).limit(1);
  if (!admin) throw new Error("Admin user not found");
  adminCookie = `${COOKIE_NAME}=${await encode({
    token: { sub: admin.id, id: admin.id, name: admin.name, email: admin.email, role: "admin", userType: "agency" },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: COOKIE_NAME,
  })}`;
}

async function setupTestData() {
  const sql = neon(process.env.DATABASE_URL!);
  const db2 = drizzle(sql);

  // Create supplier + sub-account for ad account
  const [sup] = await db2.insert(suppliers).values({
    name: "S8TestSupplier",
    contact_email: "s8sup@test.com",
  }).returning();
  testSupplierId = sup.id;

  const [sub] = await db2.insert(supplier_sub_accounts).values({
    supplier_id: testSupplierId,
    name: "S8TestSub",
  }).returning();
  testSubAccountId = sub.id;

  await db2.insert(supplier_platform_fees).values({
    supplier_id: testSupplierId,
    supplier_sub_account_id: testSubAccountId,
    platform: "meta",
    fee_rate: "2.0",
  });

  // Create client 1 via onboarding
  const onboardRes = await fetch(`${BASE}/api/onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "S8 Test Client",
      email: "s8client@test.com",
      company: "S8 Co",
      password: "TestPass123!",
    }),
  });
  const onboardData = await onboardRes.json();
  testClientId = onboardData.id;

  // Create client 2
  const onboard2Res = await fetch(`${BASE}/api/onboarding`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "S8 Test Client 2",
      email: "s8client2@test.com",
      company: "S8 Co 2",
      password: "TestPass123!",
    }),
  });
  const onboard2Data = await onboard2Res.json();
  testClient2Id = onboard2Data.id;

  // Credit client 1 with $1000
  await fetch(`${BASE}/api/clients/${testClientId}/credit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ amount: 1000, currency: "USD", is_crypto: false }),
  });

  // Create ad account for client 1
  const adRes = await fetch(`${BASE}/api/ad-accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      client_id: testClientId,
      supplier_sub_account_id: testSubAccountId,
      platform: "meta",
      account_id: "act_s8test",
      account_name: "S8 Test Meta Account",
    }),
  });
  const adData = await adRes.json();
  testAdAccountId = adData.id;

  // Build client JWTs
  clientCookie = `${COOKIE_NAME}=${await encode({
    token: { sub: testClientId, id: testClientId, name: "S8 Test Client", email: "s8client@test.com", role: "client", userType: "client" },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: COOKIE_NAME,
  })}`;

  client2Cookie = `${COOKIE_NAME}=${await encode({
    token: { sub: testClient2Id, id: testClient2Id, name: "S8 Test Client 2", email: "s8client2@test.com", role: "client", userType: "client" },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: COOKIE_NAME,
  })}`;
}

async function cleanup() {
  const sql = neon(process.env.DATABASE_URL!);
  const db2 = drizzle(sql);

  for (const cid of [testClientId, testClient2Id].filter(Boolean)) {
    await db2.delete(topup_requests).where(eq(topup_requests.client_id, cid)).catch(() => {});
    await db2.delete(transactions).where(eq(transactions.client_id, cid)).catch(() => {});
    await db2.delete(ad_accounts).where(eq(ad_accounts.client_id, cid)).catch(() => {});
    await db2.delete(clients).where(eq(clients.id, cid)).catch(() => {});
  }
  if (testSubAccountId) {
    await db2.delete(supplier_platform_fees).where(eq(supplier_platform_fees.supplier_sub_account_id, testSubAccountId)).catch(() => {});
    await db2.delete(supplier_sub_accounts).where(eq(supplier_sub_accounts.id, testSubAccountId)).catch(() => {});
  }
  if (testSupplierId) {
    await db2.delete(suppliers).where(eq(suppliers.id, testSupplierId)).catch(() => {});
  }
}

async function api(method: string, path: string, body?: unknown, cookie = clientCookie) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

before(async () => {
  await setupAuth();
  await cleanup();
  await setupTestData();
});

after(async () => {
  await cleanup();
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

describe("GET /api/portal/dashboard", () => {
  it("returns wallet balance and account info for client", async () => {
    const { status, data } = await api("GET", "/api/portal/dashboard");
    assert.equal(status, 200, JSON.stringify(data));
    assert.ok("wallet_balance" in data, "should have wallet_balance");
    assert.ok("balance_model" in data, "should have balance_model");
    assert.ok("billing_currency" in data, "should have billing_currency");
    assert.ok("active_ad_accounts_count" in data, "should have active_ad_accounts_count");
    assert.ok(Array.isArray(data.recent_transactions), "should have recent_transactions array");
    assert.ok(Array.isArray(data.pending_topups), "should have pending_topups array");
    // After crediting $1000, balance should be 1000
    assert.equal(data.wallet_balance, 1000, "wallet balance should be 1000 after crediting");
    assert.equal(data.active_ad_accounts_count, 1, "should have 1 active ad account");
  });

  it("returns 403 for agency users", async () => {
    const { status } = await api("GET", "/api/portal/dashboard", undefined, adminCookie);
    assert.equal(status, 403);
  });

  it("returns 401 for unauthenticated requests", async () => {
    const { status } = await api("GET", "/api/portal/dashboard", undefined, "");
    assert.equal(status, 401);
  });

  it("never exposes supplier fees or internal costs in recent_transactions", async () => {
    const { data } = await api("GET", "/api/portal/dashboard");
    for (const txn of data.recent_transactions ?? []) {
      assert.ok(!("supplier_fee_amount" in txn), "should not expose supplier_fee_amount");
      assert.ok(!("top_up_fee_amount" in txn), "should not expose top_up_fee_amount");
      assert.ok(!("crypto_fee_amount" in txn), "should not expose crypto_fee_amount");
      assert.ok(!("supplier_fee_rate_snapshot" in txn), "should not expose supplier_fee_rate_snapshot");
    }
  });
});

// ── Accounts ──────────────────────────────────────────────────────────────────

describe("GET /api/portal/accounts", () => {
  it("returns only the client's own ad accounts", async () => {
    const { status, data } = await api("GET", "/api/portal/accounts");
    assert.equal(status, 200, JSON.stringify(data));
    assert.ok(Array.isArray(data));
    assert.equal(data.length, 1, "should return exactly 1 account");
    assert.equal(data[0].id, testAdAccountId);
  });

  it("never exposes supplier_id, top_up_fee_rate, or commission data", async () => {
    const { data } = await api("GET", "/api/portal/accounts");
    for (const acc of data ?? []) {
      assert.ok(!("supplier_id" in acc), "should not expose supplier_id");
      assert.ok(!("top_up_fee_rate" in acc), "should not expose top_up_fee_rate");
      assert.ok(!("commission_rate" in acc), "should not expose commission_rate");
    }
  });

  it("client2 sees zero accounts (no cross-contamination)", async () => {
    const { data } = await api("GET", "/api/portal/accounts", undefined, client2Cookie);
    assert.ok(Array.isArray(data));
    assert.equal(data.length, 0, "client2 should see no accounts");
  });

  it("returns 403 for agency users", async () => {
    const { status } = await api("GET", "/api/portal/accounts", undefined, adminCookie);
    assert.equal(status, 403);
  });
});

// ── Transactions ──────────────────────────────────────────────────────────────

describe("GET /api/portal/transactions", () => {
  it("returns client transactions without internal fee fields", async () => {
    const { status, data } = await api("GET", "/api/portal/transactions");
    assert.equal(status, 200, JSON.stringify(data));
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0, "should have at least 1 transaction (the credit)");
    for (const txn of data) {
      assert.ok(!("supplier_fee_amount" in txn), "should not expose supplier_fee_amount");
      assert.ok(!("top_up_fee_amount" in txn), "should not expose top_up_fee_amount");
      assert.ok(!("crypto_fee_amount" in txn), "should not expose crypto_fee_amount");
      assert.ok(!("supplier_fee_rate_snapshot" in txn), "should not expose supplier_fee_rate_snapshot");
      assert.ok("id" in txn, "should have id");
      assert.ok("type" in txn, "should have type");
      assert.ok("amount" in txn, "should have amount");
      assert.ok("currency" in txn, "should have currency");
      assert.ok("created_at" in txn, "should have created_at");
    }
  });

  it("supports type filter", async () => {
    const { data } = await api("GET", "/api/portal/transactions?type=payment");
    assert.ok(Array.isArray(data));
    for (const txn of data) {
      assert.equal(txn.type, "payment", "all returned transactions should be type payment");
    }
  });

  it("client2 sees zero transactions", async () => {
    const { data } = await api("GET", "/api/portal/transactions", undefined, client2Cookie);
    assert.ok(Array.isArray(data));
    assert.equal(data.length, 0, "client2 should have no transactions");
  });

  it("returns 403 for agency users", async () => {
    const { status } = await api("GET", "/api/portal/transactions", undefined, adminCookie);
    assert.equal(status, 403);
  });
});

// ── Top Up Requests ───────────────────────────────────────────────────────────

describe("POST /api/portal/topup-requests", () => {
  it("creates a top up request for the client's own ad account", async () => {
    const { status, data } = await api("POST", "/api/portal/topup-requests", {
      ad_account_id: testAdAccountId,
      amount: 100,
      currency: "USD",
    });
    assert.equal(status, 201, JSON.stringify(data));
    assert.ok(data.id, "should return id");
    assert.equal(data.status, "approved", "should be approved (sufficient funds)");
    assert.ok(!("supplier_fee_amount" in data), "should not expose supplier_fee_amount");
  });

  it("returns insufficient_funds when balance is too low", async () => {
    const { status, data } = await api("POST", "/api/portal/topup-requests", {
      ad_account_id: testAdAccountId,
      amount: 999999,
      currency: "USD",
    });
    assert.equal(status, 201, JSON.stringify(data));
    assert.equal(data.status, "insufficient_funds");
  });

  it("returns 404 if client tries to use another client's ad account", async () => {
    const { status } = await api("POST", "/api/portal/topup-requests", {
      ad_account_id: testAdAccountId,
      amount: 50,
      currency: "USD",
    }, client2Cookie);
    assert.equal(status, 404, "should not allow client2 to use client1 ad account");
  });

  it("returns 400 for invalid body", async () => {
    const { status } = await api("POST", "/api/portal/topup-requests", {
      ad_account_id: "not-a-uuid",
      amount: -10,
    });
    assert.equal(status, 400);
  });

  it("returns 403 for agency users", async () => {
    const { status } = await api("POST", "/api/portal/topup-requests", {
      ad_account_id: testAdAccountId,
      amount: 50,
      currency: "USD",
    }, adminCookie);
    assert.equal(status, 403);
  });
});

describe("GET /api/portal/topup-requests", () => {
  it("returns client's own top up requests only", async () => {
    const { status, data } = await api("GET", "/api/portal/topup-requests");
    assert.equal(status, 200, JSON.stringify(data));
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0, "should have requests created in previous test");
    for (const req of data) {
      assert.ok(!("supplier_id" in req), "should not expose supplier_id");
    }
  });

  it("supports status filter", async () => {
    const { data } = await api("GET", "/api/portal/topup-requests?status=approved");
    assert.ok(Array.isArray(data));
    for (const req of data) {
      assert.equal(req.status, "approved");
    }
  });

  it("client2 sees zero requests", async () => {
    const { data } = await api("GET", "/api/portal/topup-requests", undefined, client2Cookie);
    assert.ok(Array.isArray(data));
    assert.equal(data.length, 0);
  });
});
