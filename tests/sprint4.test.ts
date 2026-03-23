/**
 * Sprint 4 integration tests — Suppliers + Ad Accounts Module (with sub-account hierarchy)
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
import { eq } from "drizzle-orm";
import { users, clients, suppliers, supplier_sub_accounts, supplier_platform_fees, ad_accounts } from "../db/schema";

const BASE = "http://localhost:3000";
const COOKIE_NAME = "authjs.session-token";
const SALT = COOKIE_NAME;

const TEST_SUPPLIER_NAME = "Test Supplier Sprint4";
const TEST_CLIENT_EMAIL = "test-sprint4-client@example.com";

let authCookie = "";
let testSupplierId = "";
let testSubAccountId = "";
let testClientId = "";
let testAdAccountId = "";

async function setupAuth() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);
  const [admin] = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.email, "admin@reward-agency.com"))
    .limit(1);
  if (!admin) throw new Error("Admin user not found");

  const token = await encode({
    token: { sub: admin.id, id: admin.id, name: admin.name, email: admin.email, role: "admin", userType: "agency" },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: SALT,
  });
  authCookie = `${COOKIE_NAME}=${token}`;
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: authCookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

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

  // Delete test suppliers (cascade: sub_accounts → platform_fees, ad_accounts)
  const testSuppliers = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.name, TEST_SUPPLIER_NAME));
  for (const s of testSuppliers) {
    await db.delete(ad_accounts).where(eq(ad_accounts.supplier_id, s.id));
    const subs = await db.select({ id: supplier_sub_accounts.id }).from(supplier_sub_accounts).where(eq(supplier_sub_accounts.supplier_id, s.id));
    for (const sa of subs) {
      await db.delete(supplier_platform_fees).where(eq(supplier_platform_fees.supplier_sub_account_id, sa.id));
    }
    await db.delete(supplier_sub_accounts).where(eq(supplier_sub_accounts.supplier_id, s.id));
    await db.delete(suppliers).where(eq(suppliers.id, s.id));
  }
}

before(async () => {
  await setupAuth();
  await cleanup();

  // Create a test client
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
  it("returns array with sub_accounts and kpis fields", async () => {
    const { status, data } = await api("GET", "/api/suppliers");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    const found = data.find((s: { id: string }) => s.id === testSupplierId);
    assert.ok(found, "newly created supplier not in list");
    assert.ok("sub_accounts" in found, "sub_accounts field missing");
    assert.ok("kpis" in found, "kpis field missing");
    assert.ok("total_payments_sent" in found.kpis);
    assert.ok("remaining_balance" in found.kpis);
    assert.ok("total_sub_accounts" in found.kpis);
  });
});

// ── Sub-Accounts ──────────────────────────────────────────────────────────────
describe("POST /api/suppliers/[id]/sub-accounts — create sub-account", () => {
  it("creates a sub-account with platform fees", async () => {
    const { status, data } = await api("POST", `/api/suppliers/${testSupplierId}/sub-accounts`, {
      name: "Whitehat",
      platform_fees: { meta: 3.5, google: 2.0 },
    });
    assert.equal(status, 201);
    assert.equal(data.name, "Whitehat");
    assert.ok(Array.isArray(data.platform_fees));
    const metaFee = data.platform_fees.find((f: { platform: string }) => f.platform === "meta");
    assert.ok(metaFee, "meta fee not created");
    assert.equal(parseFloat(metaFee.fee_rate), 3.5);
    testSubAccountId = data.id;
  });

  it("rejects missing name", async () => {
    const { status } = await api("POST", `/api/suppliers/${testSupplierId}/sub-accounts`, {
      platform_fees: { meta: 1 },
    });
    assert.equal(status, 400);
  });
});

describe("GET /api/suppliers/[id] — detail with sub-accounts", () => {
  it("returns supplier with sub_accounts array containing platform fees", async () => {
    const { status, data } = await api("GET", `/api/suppliers/${testSupplierId}`);
    assert.equal(status, 200);
    assert.equal(data.id, testSupplierId);
    assert.ok(Array.isArray(data.sub_accounts));
    const whitehat = data.sub_accounts.find((sa: { name: string }) => sa.name === "Whitehat");
    assert.ok(whitehat, "Whitehat sub-account not found");
    assert.ok(Array.isArray(whitehat.platform_fees));
    const metaFee = whitehat.platform_fees.find((f: { platform: string }) => f.platform === "meta");
    assert.ok(metaFee, "meta fee missing from sub-account");
    assert.equal(parseFloat(metaFee.fee_rate), 3.5);
  });

  it("returns kpis with expected fields", async () => {
    const { status, data } = await api("GET", `/api/suppliers/${testSupplierId}`);
    assert.equal(status, 200);
    assert.ok("kpis" in data);
    assert.equal(typeof data.kpis.total_payments_sent, "number");
    assert.equal(typeof data.kpis.total_topups, "number");
    assert.equal(typeof data.kpis.remaining_balance, "number");
    assert.equal(data.kpis.total_sub_accounts, 1);
  });

  it("returns 404 for unknown supplier", async () => {
    const { status } = await api("GET", "/api/suppliers/00000000-0000-0000-0000-000000000000");
    assert.equal(status, 404);
  });
});

describe("PATCH /api/suppliers/[id]/sub-accounts/[subId] — update sub-account", () => {
  it("updates name and fees", async () => {
    const { status, data } = await api("PATCH", `/api/suppliers/${testSupplierId}/sub-accounts/${testSubAccountId}`, {
      name: "Whitehat Updated",
      platform_fees: { meta: 4.0, tiktok: 1.5 },
    });
    assert.equal(status, 200);
    assert.equal(data.name, "Whitehat Updated");
    const metaFee = data.platform_fees.find((f: { platform: string }) => f.platform === "meta");
    assert.equal(parseFloat(metaFee.fee_rate), 4.0);
  });
});

describe("POST /api/suppliers/[id]/platform-fees — set fee (now requires sub-account)", () => {
  it("upserts a platform fee for a specific sub-account", async () => {
    const { status, data } = await api("POST", `/api/suppliers/${testSupplierId}/platform-fees`, {
      supplier_sub_account_id: testSubAccountId,
      platform: "snapchat",
      fee_rate: 2.5,
    });
    assert.equal(status, 200);
    assert.equal(data.platform, "snapchat");
    assert.equal(parseFloat(data.fee_rate), 2.5);
  });

  it("rejects missing supplier_sub_account_id", async () => {
    const { status } = await api("POST", `/api/suppliers/${testSupplierId}/platform-fees`, {
      platform: "meta",
      fee_rate: 3,
    });
    assert.equal(status, 400);
  });

  it("rejects invalid platform", async () => {
    const { status } = await api("POST", `/api/suppliers/${testSupplierId}/platform-fees`, {
      supplier_sub_account_id: testSubAccountId,
      platform: "twitter",
      fee_rate: 3,
    });
    assert.equal(status, 400);
  });
});

describe("PATCH /api/suppliers/[id] — update supplier", () => {
  it("updates supplier status", async () => {
    const { status, data } = await api("PATCH", `/api/suppliers/${testSupplierId}`, {
      name: TEST_SUPPLIER_NAME,
      status: "active",
    });
    assert.equal(status, 200);
    assert.equal(data.status, "active");
  });
});

// ── Ad Accounts ───────────────────────────────────────────────────────────────
describe("POST /api/ad-accounts — create with sub-account", () => {
  it("creates ad account with supplier_sub_account_id, auto-populates supplier_id", async () => {
    const { status, data } = await api("POST", "/api/ad-accounts", {
      client_id: testClientId,
      supplier_sub_account_id: testSubAccountId,
      platform: "meta",
      account_id: "act_sprint4_test",
      account_name: "Sprint4 Test Account",
      top_up_fee_rate: 3.5,
    });
    assert.equal(status, 201);
    assert.equal(data.platform, "meta");
    assert.equal(data.account_name, "Sprint4 Test Account");
    assert.equal(data.supplier_id, testSupplierId, "supplier_id should be auto-populated from sub-account");
    assert.equal(data.supplier_sub_account_id, testSubAccountId);
    testAdAccountId = data.id;
  });

  it("rejects unknown supplier_sub_account_id", async () => {
    const { status } = await api("POST", "/api/ad-accounts", {
      client_id: testClientId,
      supplier_sub_account_id: "00000000-0000-0000-0000-000000000000",
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
      supplier_sub_account_id: testSubAccountId,
      platform: "twitter",
      account_id: "act_bad",
      account_name: "Bad",
      top_up_fee_rate: 0,
    });
    assert.equal(status, 400);
  });
});

describe("GET /api/ad-accounts — filter and sub-account info", () => {
  it("returns ad accounts with sub_account_name", async () => {
    const { status, data } = await api("GET", "/api/ad-accounts?platform=meta");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    const found = data.find((a: { id: string }) => a.id === testAdAccountId);
    assert.ok(found, "ad account not found");
    assert.ok("sub_account_name" in found, "sub_account_name field missing");
    assert.ok("supplier_name" in found, "supplier_name field missing");
  });

  it("returns empty for tiktok filter on test client", async () => {
    const { status, data } = await api("GET", `/api/ad-accounts?client_id=${testClientId}&platform=tiktok`);
    assert.equal(status, 200);
    assert.equal(data.length, 0);
  });
});

describe("PATCH /api/ad-accounts/[id] — update", () => {
  it("updates status to paused", async () => {
    const { status, data } = await api("PATCH", `/api/ad-accounts/${testAdAccountId}`, { status: "paused" });
    assert.equal(status, 200);
    assert.equal(data.status, "paused");
  });

  it("updates top_up_fee_rate", async () => {
    const { status, data } = await api("PATCH", `/api/ad-accounts/${testAdAccountId}`, { top_up_fee_rate: 7.25 });
    assert.equal(status, 200);
    assert.equal(parseFloat(data.top_up_fee_rate), 7.25);
  });
});

describe("GET /api/ad-accounts/[id] — single account", () => {
  it("returns the ad account with supplier and sub-account info", async () => {
    const { status, data } = await api("GET", `/api/ad-accounts/${testAdAccountId}`);
    assert.equal(status, 200);
    assert.equal(data.id, testAdAccountId);
    assert.ok(data.supplier_name, "supplier_name should be present");
    assert.ok(data.sub_account_name, "sub_account_name should be present");
    assert.equal(data.supplier_id, testSupplierId);
  });
});
