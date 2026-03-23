/**
 * Sprint 3 integration tests — Clients Module
 * Requires dev server at http://localhost:3000
 * Run: npm run test:sprint3
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { encode } from "next-auth/jwt";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { users, clients, transactions } from "../db/schema";

const BASE = "http://localhost:3000";
const TEST_EMAIL = "test-sprint3@example.com";
const TEST_FIELDS_EMAIL = "test-sprint3-fields@example.com";
const COOKIE_NAME = "authjs.session-token";
const SALT = COOKIE_NAME;

let authCookie = "";
let testClientId = "";

// ── Auth helper ──────────────────────────────────────────────────────────────
async function setupAuth() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);
  const [admin] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, "admin@reward-agency.com"))
    .limit(1);

  if (!admin) throw new Error("Admin user not found — run db:seed first");

  const token = await encode({
    token: {
      sub: admin.id,
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: "admin",
      userType: "agency",
    },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: SALT,
  });
  authCookie = `${COOKIE_NAME}=${token}`;
}

// ── Request helpers ──────────────────────────────────────────────────────────
async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: authCookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// ── Cleanup ──────────────────────────────────────────────────────────────────
async function cleanup() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);
  const emailsToClean = [TEST_EMAIL, TEST_FIELDS_EMAIL];
  for (const email of emailsToClean) {
    const testClients = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.email, email));
    for (const c of testClients) {
      await db.delete(transactions).where(eq(transactions.client_id, c.id));
    }
    await db.delete(clients).where(eq(clients.email, email));
  }
}

// ── Test suite ───────────────────────────────────────────────────────────────
before(async () => {
  await setupAuth();
  await cleanup(); // clean before tests
});

after(async () => {
  await cleanup(); // clean after tests
});

describe("POST /api/clients — create client", () => {
  it("creates a client and returns RWD-XXXX code", async () => {
    const { status, data } = await api("POST", "/api/clients", {
      name: "Test Client Sprint3",
      email: TEST_EMAIL,
      company: "Test Corp",
      balance_model: "classic",
      billing_currency: "USD",
      crypto_fee_rate: 2,
    });
    assert.equal(status, 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
    assert.ok(data.id, "Response should have id");
    assert.match(data.client_code, /^RWD-\d{4}$/, `client_code format invalid: ${data.client_code}`);
    assert.equal(data.balance_model, "classic");
    assert.equal(data.billing_currency, "USD");
    testClientId = data.id;
  });

  it("rejects duplicate email", async () => {
    const { status } = await api("POST", "/api/clients", {
      name: "Duplicate",
      email: TEST_EMAIL,
      balance_model: "classic",
      billing_currency: "USD",
    });
    assert.equal(status, 400, "Duplicate email should return 400 or 500");
  });

  it("rejects invalid body (missing required fields)", async () => {
    const { status } = await api("POST", "/api/clients", { name: "No email" });
    assert.equal(status, 400);
  });
});

describe("GET /api/clients — list clients", () => {
  it("returns array with wallet_balance field", async () => {
    const { status, data } = await api("GET", "/api/clients");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data), "Response should be an array");
    const testClient = data.find((c: { id: string }) => c.id === testClientId);
    assert.ok(testClient, "Test client should be in list");
    assert.ok("wallet_balance" in testClient, "Should have wallet_balance field");
    assert.equal(typeof testClient.wallet_balance, "number", "wallet_balance should be a number");
  });

  it("supports search by name", async () => {
    const { status, data } = await api("GET", "/api/clients?search=Test+Client+Sprint3");
    assert.equal(status, 200);
    assert.ok(data.some((c: { id: string }) => c.id === testClientId), "Search should find test client");
  });

  it("supports status filter", async () => {
    const { status, data } = await api("GET", "/api/clients?status=active");
    assert.equal(status, 200);
    for (const c of data) {
      assert.equal(c.status, "active", "All returned clients should be active");
    }
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await fetch(`${BASE}/api/clients`);
    assert.equal(res.status, 401);
  });
});

describe("GET /api/clients/[id] — single client", () => {
  it("returns client with wallet_balance, transactions, ad_accounts", async () => {
    const { status, data } = await api("GET", `/api/clients/${testClientId}`);
    assert.equal(status, 200);
    assert.equal(data.id, testClientId);
    assert.ok("wallet_balance" in data, "Should have wallet_balance");
    assert.ok(Array.isArray(data.transactions), "Should have transactions array");
    assert.ok(Array.isArray(data.ad_accounts), "Should have ad_accounts array");
  });

  it("returns 404 for unknown id", async () => {
    const { status } = await api("GET", "/api/clients/00000000-0000-0000-0000-000000000000");
    assert.equal(status, 404);
  });
});

describe("PATCH /api/clients/[id] — update client", () => {
  it("updates allowed fields", async () => {
    const { status, data } = await api("PATCH", `/api/clients/${testClientId}`, {
      name: "Updated Sprint3 Client",
      status: "paused",
    });
    assert.equal(status, 200, `Got: ${JSON.stringify(data)}`);
    assert.equal(data.name, "Updated Sprint3 Client");
    assert.equal(data.status, "paused");
  });

  it("rejects balance_model change", async () => {
    const { status, data } = await api("PATCH", `/api/clients/${testClientId}`, {
      balance_model: "dynamic",
    });
    assert.equal(status, 400, "balance_model change should be rejected");
    assert.ok(data.error?.includes("balance_model"), `Error message should mention balance_model: ${data.error}`);
  });
});

describe("POST /api/clients/[id]/credit — credit wallet", () => {
  it("creates a payment transaction (USD)", async () => {
    const { status, data } = await api("POST", `/api/clients/${testClientId}/credit`, {
      amount: 1000,
      currency: "USD",
      description: "Sprint3 test credit",
    });
    assert.equal(status, 201, `Got: ${JSON.stringify(data)}`);
    assert.ok(data.transaction, "Should return transaction");
    assert.equal(data.transaction.type, "payment");
    assert.equal(data.transaction.currency, "USD");
    assert.equal(parseFloat(data.transaction.amount), 1000, "USD amount should be unchanged");
    assert.equal(typeof data.wallet_balance, "number");
  });

  it("deducts crypto fee for USDT (2% rate)", async () => {
    const { status, data } = await api("POST", `/api/clients/${testClientId}/credit`, {
      amount: 500,
      currency: "USDT",
      description: "Crypto test",
    });
    assert.equal(status, 201, `Got: ${JSON.stringify(data)}`);
    assert.equal(data.transaction.is_crypto, true);
    // crypto_fee_rate = 2%, fee = 10, net = 490
    const expectedFee = 10;
    const expectedNet = 490;
    assert.equal(
      parseFloat(data.transaction.amount),
      expectedNet,
      `Net amount should be ${expectedNet}, got ${data.transaction.amount}`
    );
    assert.equal(
      parseFloat(data.transaction.crypto_fee_amount),
      expectedFee,
      `Crypto fee should be ${expectedFee}, got ${data.transaction.crypto_fee_amount}`
    );
  });
});

describe("Wallet balance calculations", () => {
  it("classic balance = SUM(payments) - SUM(topups+withdraws+refunds)", async () => {
    // At this point we have: 1000 USD payment + 490 USDT payment (net)
    // classic deductions = 0 → balance = 1000 + 490 = 1490
    const { data } = await api("GET", `/api/clients/${testClientId}`);
    assert.equal(data.balance_model, "classic");
    assert.equal(data.wallet_balance, 1490, `Classic balance should be 1490, got ${data.wallet_balance}`);
  });

  it("dynamic model balance uses spend_records", async () => {
    // Create a dynamic client
    const { data: created } = await api("POST", "/api/clients", {
      name: "Dynamic Sprint3",
      email: "dynamic-sprint3@example.com",
      company: "Dyn Corp",
      balance_model: "dynamic",
      billing_currency: "USD",
      crypto_fee_rate: 0,
    });
    assert.ok(created.id, "Dynamic client should be created");
    const dynId: string = created.id;

    // Credit 1000 USD
    await api("POST", `/api/clients/${dynId}/credit`, { amount: 1000, currency: "USD" });

    // Insert a spend_record directly via API isn't available yet,
    // so we verify balance = 1000 (no spends)
    const { data } = await api("GET", `/api/clients/${dynId}`);
    assert.equal(data.balance_model, "dynamic");
    assert.equal(data.wallet_balance, 1000, `Dynamic balance should be 1000, got ${data.wallet_balance}`);

    // Cleanup dynamic test client
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql);
    await db.delete(transactions).where(eq(transactions.client_id, dynId));
    await db.delete(clients).where(eq(clients.id, dynId));
  });
});

// ── New fields tests ──────────────────────────────────────────────────────────
describe("POST /api/clients — new fields (notes, setup, platform fees)", () => {
  it("creates client with notes, has_setup and platform fees", async () => {
    const { status, data } = await api("POST", "/api/clients", {
      name: "Fields Test Client",
      email: TEST_FIELDS_EMAIL,
      balance_model: "classic",
      billing_currency: "USD",
      crypto_fee_rate: 0,
      notes: "Internal test notes",
      has_setup: true,
      setup_monthly_fee: 500,
      setup_monthly_cost: 200,
      client_platform_fees: { meta: 2, google: 1.5, tiktok: 0, snapchat: 0, pinterest: 0 },
    });
    assert.equal(status, 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
    assert.equal(data.notes, "Internal test notes");
    assert.equal(data.has_setup, true);
    assert.equal(parseFloat(data.setup_monthly_fee), 500);
    assert.equal(parseFloat(data.setup_monthly_cost), 200);
    assert.ok(data.client_platform_fees, "Should have client_platform_fees");
    assert.equal(data.client_platform_fees.meta, 2);
    assert.equal(data.client_platform_fees.google, 1.5);
  });

  it("GET /api/clients/[id] returns new fields", async () => {
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql);
    const [c] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.email, TEST_FIELDS_EMAIL))
      .limit(1);
    assert.ok(c, "Fields test client should exist");

    const { status, data } = await api("GET", `/api/clients/${c.id}`);
    assert.equal(status, 200);
    assert.equal(data.notes, "Internal test notes");
    assert.equal(data.has_setup, true);
    assert.ok("setup_monthly_fee" in data, "Should have setup_monthly_fee");
    assert.ok("client_platform_fees" in data, "Should have client_platform_fees");
  });
});

// ── Withdraw / Refund tests ───────────────────────────────────────────────────
describe("POST /api/clients/[id]/withdraw — debit wallet", () => {
  it("creates a withdraw transaction and decreases balance", async () => {
    // testClientId has balance 1490 at this point (1000 USD + 490 USDT net)
    const { status, data } = await api("POST", `/api/clients/${testClientId}/withdraw`, {
      amount: 100,
      type: "withdraw",
      description: "Test withdraw",
    });
    assert.equal(status, 201, `Got: ${JSON.stringify(data)}`);
    assert.ok(data.transaction, "Should return transaction");
    assert.equal(data.transaction.type, "withdraw");
    assert.equal(parseFloat(data.transaction.amount), 100);
    assert.equal(typeof data.wallet_balance, "number");
    assert.equal(data.wallet_balance, 1390, `Balance should be 1390, got ${data.wallet_balance}`);
  });

  it("creates a refund transaction and decreases balance", async () => {
    const { status, data } = await api("POST", `/api/clients/${testClientId}/withdraw`, {
      amount: 50,
      type: "refund",
      description: "Test refund",
    });
    assert.equal(status, 201, `Got: ${JSON.stringify(data)}`);
    assert.equal(data.transaction.type, "refund");
    assert.equal(parseFloat(data.transaction.amount), 50);
    assert.equal(data.wallet_balance, 1340, `Balance should be 1340, got ${data.wallet_balance}`);
  });

  it("wallet balance reflects both withdraw and refund", async () => {
    const { data } = await api("GET", `/api/clients/${testClientId}`);
    assert.equal(data.wallet_balance, 1340, `Balance should be 1340, got ${data.wallet_balance}`);
  });

  it("rejects invalid type", async () => {
    const { status } = await api("POST", `/api/clients/${testClientId}/withdraw`, {
      amount: 50,
      type: "payment",
    });
    assert.equal(status, 400, "Invalid type should return 400");
  });

  it("rejects non-positive amount", async () => {
    const { status } = await api("POST", `/api/clients/${testClientId}/withdraw`, {
      amount: -10,
      type: "withdraw",
    });
    assert.equal(status, 400, "Negative amount should return 400");
  });
});
