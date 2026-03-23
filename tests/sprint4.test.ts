/**
 * Sprint 4 integration tests — Suppliers + Ad Accounts Module
 * Requires dev server at http://localhost:3000
 * Run: npm run test:sprint4
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { encode } from "next-auth/jwt";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, inArray } from "drizzle-orm";
import { users, clients, suppliers, supplier_platform_fees, ad_accounts } from "../db/schema";

const BASE = "http://localhost:3000";
const COOKIE_NAME = "authjs.session-token";
const SALT = COOKIE_NAME;

// Test identifiers
const TEST_SUPPLIER_NAME = "Test Supplier Sprint4";
const TEST_CLIENT_EMAIL = "test-sprint4-client@example.com";

let authCookie = "";
let testSupplierId = "";
let testClientId = "";
let testAdAccountId = "";

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

// ── Request helper ────────────────────────────────────────────────────────────
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

  // Delete test ad accounts
  if (testAdAccountId) {
    await db.delete(ad_accounts).where(eq(ad_accounts.id, testAdAccountId)).catch(() => {});
  }

  // Delete test client's ad accounts then client
  const testClients = await db.select({ id: clients.id }).from(clients).where(eq(clients.email, TEST_CLIENT_EMAIL));
  for (const c of testClients) {
    await db.delete(ad_accounts).where(eq(ad_accounts.client_id, c.id));
  }
  await db.delete(clients).where(eq(clients.email, TEST_CLIENT_EMAIL));

  // Delete test supplier (cascades platform_fees)
  const testSuppliers = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.name, TEST_SUPPLIER_NAME));
  for (const s of testSuppliers) {
    await db.delete(ad_accounts).where(eq(ad_accounts.supplier_id, s.id));
    await db.delete(suppliers).where(eq(suppliers.id, s.id));
  }
}

// ── Seed client ───────────────────────────────────────────────────────────────
before(async () => {
  await setupAuth();
  await cleanup();

  // Create a test client for ad account tests
  const { status, data } = await api("POST", "/api/clients", {
    name: "Test Client Sprint4",
    email: TEST_CLIENT_EMAIL,
    company: "Sprint4 Corp",
    balance_model: "classic",
    billing_currency: "USD",
  });
  assert.equal(status, 201, `Failed to create test client: ${JSON.stringify(data)}`);
  testClientId = data.id;
});

after(async () => {
  await cleanup();
});

// ── Suppliers ─────────────────────────────────────────────────────────────────
describe("POST /api/suppliers — create supplier", () => {
  it("creates a supplier and returns 201", async () => {
    const { status, data } = await api("POST", "/api/suppliers", {
      name: TEST_SUPPLIER_NAME,
      contact_email: "supplier-sprint4@example.com",
    });
    assert.equal(status, 201);
    assert.equal(data.name, TEST_SUPPLIER_NAME);
    assert.equal(data.status, "active");
    testSupplierId = data.id;
  });

  it("rejects missing name", async () => {
    const { status } = await api("POST", "/api/suppliers", { contact_email: "x@x.com" });
    assert.equal(status, 400);
  });
});

describe("GET /api/suppliers — list suppliers", () => {
  it("returns array including new supplier", async () => {
    const { status, data } = await api("GET", "/api/suppliers");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    const found = data.find((s: { id: string }) => s.id === testSupplierId);
    assert.ok(found, "newly created supplier not in list");
    assert.ok("platform_fees" in found);
    assert.ok("ad_accounts_count" in found);
  });
});

describe("POST /api/suppliers/[id]/platform-fees — set platform fee", () => {
  it("upserts a platform fee", async () => {
    const { status, data } = await api("POST", `/api/suppliers/${testSupplierId}/platform-fees`, {
      platform: "meta",
      fee_rate: 5.5,
    });
    assert.equal(status, 200);
    assert.equal(data.platform, "meta");
    assert.equal(parseFloat(data.fee_rate), 5.5);
  });

  it("updates existing platform fee on second call", async () => {
    const { status, data } = await api("POST", `/api/suppliers/${testSupplierId}/platform-fees`, {
      platform: "meta",
      fee_rate: 6.0,
    });
    assert.equal(status, 200);
    assert.equal(parseFloat(data.fee_rate), 6.0);
  });

  it("rejects invalid platform", async () => {
    const { status } = await api("POST", `/api/suppliers/${testSupplierId}/platform-fees`, {
      platform: "twitter",
      fee_rate: 3,
    });
    assert.equal(status, 400);
  });
});

describe("GET /api/suppliers/[id] — supplier detail", () => {
  it("returns supplier with platform_fees array", async () => {
    const { status, data } = await api("GET", `/api/suppliers/${testSupplierId}`);
    assert.equal(status, 200);
    assert.equal(data.id, testSupplierId);
    assert.ok(Array.isArray(data.platform_fees));
    const metaFee = data.platform_fees.find((f: { platform: string }) => f.platform === "meta");
    assert.ok(metaFee, "meta fee not found");
    assert.equal(parseFloat(metaFee.fee_rate), 6.0);
  });

  it("returns 404 for unknown supplier", async () => {
    const { status } = await api("GET", "/api/suppliers/00000000-0000-0000-0000-000000000000");
    assert.equal(status, 404);
  });
});

describe("PATCH /api/suppliers/[id] — update supplier", () => {
  it("updates supplier name", async () => {
    const { status, data } = await api("PATCH", `/api/suppliers/${testSupplierId}`, {
      name: TEST_SUPPLIER_NAME, // keep same name for cleanup
      status: "active",
    });
    assert.equal(status, 200);
    assert.equal(data.status, "active");
  });
});

// ── Ad Accounts ───────────────────────────────────────────────────────────────
describe("POST /api/ad-accounts — create ad account", () => {
  it("creates an ad account", async () => {
    const { status, data } = await api("POST", "/api/ad-accounts", {
      client_id: testClientId,
      supplier_id: testSupplierId,
      platform: "meta",
      account_id: "act_sprint4_test",
      account_name: "Sprint4 Test Account",
      top_up_fee_rate: 5.5,
    });
    assert.equal(status, 201);
    assert.equal(data.platform, "meta");
    assert.equal(data.account_name, "Sprint4 Test Account");
    assert.equal(parseFloat(data.top_up_fee_rate), 5.5);
    testAdAccountId = data.id;
  });

  it("rejects unknown client_id", async () => {
    const { status } = await api("POST", "/api/ad-accounts", {
      client_id: "00000000-0000-0000-0000-000000000000",
      supplier_id: testSupplierId,
      platform: "meta",
      account_id: "act_bad",
      account_name: "Bad",
      top_up_fee_rate: 0,
    });
    assert.equal(status, 404);
  });

  it("rejects invalid platform", async () => {
    const { status } = await api("POST", "/api/ad-accounts", {
      client_id: testClientId,
      supplier_id: testSupplierId,
      platform: "twitter",
      account_id: "act_bad",
      account_name: "Bad",
      top_up_fee_rate: 0,
    });
    assert.equal(status, 400);
  });
});

describe("GET /api/ad-accounts — filter by platform", () => {
  it("returns ad accounts filtered by platform=meta", async () => {
    const { status, data } = await api("GET", "/api/ad-accounts?platform=meta");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    const found = data.find((a: { id: string }) => a.id === testAdAccountId);
    assert.ok(found, "newly created ad account not found in meta filter");
    assert.equal(found.platform, "meta");
  });

  it("returns empty list for platform=tiktok (no test accounts)", async () => {
    const { status, data } = await api("GET", `/api/ad-accounts?client_id=${testClientId}&platform=tiktok`);
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    assert.equal(data.length, 0);
  });
});

describe("PATCH /api/ad-accounts/[id] — update ad account", () => {
  it("updates status to paused", async () => {
    const { status, data } = await api("PATCH", `/api/ad-accounts/${testAdAccountId}`, {
      status: "paused",
    });
    assert.equal(status, 200);
    assert.equal(data.status, "paused");
  });

  it("updates top_up_fee_rate", async () => {
    const { status, data } = await api("PATCH", `/api/ad-accounts/${testAdAccountId}`, {
      top_up_fee_rate: 7.25,
    });
    assert.equal(status, 200);
    assert.equal(parseFloat(data.top_up_fee_rate), 7.25);
  });
});

describe("GET /api/ad-accounts/[id] — single ad account", () => {
  it("returns the ad account with client and supplier info", async () => {
    const { status, data } = await api("GET", `/api/ad-accounts/${testAdAccountId}`);
    assert.equal(status, 200);
    assert.equal(data.id, testAdAccountId);
    assert.ok(data.client_name, "client_name should be present");
    assert.ok(data.supplier_name, "supplier_name should be present");
  });
});
