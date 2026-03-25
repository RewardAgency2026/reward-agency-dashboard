/**
 * Sprint 6 integration tests
 * Requires dev server at http://localhost:3000
 * Run: npm run test:sprint6
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { encode } from "next-auth/jwt";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, gte } from "drizzle-orm";
import {
  users, clients, ad_accounts, suppliers, supplier_sub_accounts,
  topup_requests, transactions, audit_logs,
} from "../db/schema";

const BASE = "http://localhost:3000";
const COOKIE_NAME = "authjs.session-token";

let adminCookie = "";
let teamCookie = "";

// Shared test fixtures (created in before, cleaned in after)
let testClientId = "";
let testAdAccountId = "";
let testSupplierId = "";
let testSubAccountId = "";

async function setupAuth() {
  const sql = neon(process.env.DATABASE_URL!);
  const db2 = drizzle(sql);

  const [admin] = await db2.select().from(users).where(eq(users.email, "admin@reward-agency.com")).limit(1);
  const [team] = await db2.select().from(users).where(eq(users.email, "team@reward-agency.com")).limit(1);
  if (!admin || !team) throw new Error("Test users not found");

  adminCookie = `${COOKIE_NAME}=${await encode({
    token: { sub: admin.id, id: admin.id, name: admin.name, email: admin.email, role: "admin", userType: "agency" },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: COOKIE_NAME,
  })}`;
  teamCookie = `${COOKIE_NAME}=${await encode({
    token: { sub: team.id, id: team.id, name: team.name, email: team.email, role: "team", userType: "agency" },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: COOKIE_NAME,
  })}`;
}

async function api(method: string, path: string, body?: unknown, cookie = adminCookie) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function cleanup() {
  const sql = neon(process.env.DATABASE_URL!);
  const db2 = drizzle(sql);
  if (testClientId) {
    await db2.delete(topup_requests).where(eq(topup_requests.client_id, testClientId)).catch(() => {});
    await db2.delete(transactions).where(eq(transactions.client_id, testClientId)).catch(() => {});
    await db2.delete(ad_accounts).where(eq(ad_accounts.client_id, testClientId)).catch(() => {});
    await db2.delete(clients).where(eq(clients.id, testClientId)).catch(() => {});
  }
  if (testSubAccountId) {
    await db2.delete(supplier_sub_accounts).where(eq(supplier_sub_accounts.id, testSubAccountId)).catch(() => {});
  }
  if (testSupplierId) {
    await db2.delete(suppliers).where(eq(suppliers.id, testSupplierId)).catch(() => {});
  }
}

before(async () => {
  await setupAuth();
  await cleanup();

  // Create shared supplier + sub-account
  const { data: sup } = await api("POST", "/api/suppliers", { name: "Sprint6 Supplier", contact_email: "s6@test.com" });
  testSupplierId = sup.id;
  const { data: sub } = await api("POST", `/api/suppliers/${testSupplierId}/sub-accounts`, {
    name: "S6 Sub", platform_fees: { meta: 2.0 },
  });
  testSubAccountId = sub.id;

  // Create client with $500 balance and 5% meta commission
  const { data: client } = await api("POST", "/api/clients", {
    name: "Sprint6 Client", email: "s6client@test.com", company: "S6 Co",
    balance_model: "classic", billing_currency: "USD",
    client_platform_fees: { meta: 5.0 },
  });
  testClientId = client.client.id;
  await api("POST", `/api/clients/${testClientId}/credit`, { amount: 500, currency: "USD", is_crypto: false });

  // Create ad account
  const { data: adAcc } = await api("POST", "/api/ad-accounts", {
    client_id: testClientId, supplier_sub_account_id: testSubAccountId,
    platform: "meta", account_id: "act_s6", account_name: "Sprint6 Meta",
  });
  testAdAccountId = adAcc.id;
});

after(async () => {
  await cleanup();
});

// ── 1 & 2: Audit logs access control ────────────────────────────────────────

describe("GET /api/audit-logs", () => {
  it("returns entries for admin", async () => {
    const { status, data } = await api("GET", "/api/audit-logs");
    assert.equal(status, 200, JSON.stringify(data));
    assert.ok(Array.isArray(data), "response should be an array");
    assert.ok(data.length > 0, "should have at least one audit log entry");
    assert.ok("action" in data[0], "entries should have action field");
    assert.ok("user_name" in data[0], "entries should have user_name field");
  });

  it("returns 403 for team role", async () => {
    const { status } = await api("GET", "/api/audit-logs", undefined, teamCookie);
    assert.equal(status, 403);
  });
});

// ── 3, 4, 5: Transactions filtering ─────────────────────────────────────────

describe("GET /api/transactions", () => {
  it("returns transaction list with joined fields", async () => {
    const { status, data } = await api("GET", "/api/transactions");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0, "should have at least one transaction");
    const row = data[0];
    assert.ok("type" in row, "should have type");
    assert.ok("amount" in row, "should have amount");
    assert.ok("currency" in row, "should have currency");
    assert.ok("client_name" in row, "should have client_name");
  });

  it("filters by type correctly", async () => {
    const { status, data } = await api("GET", "/api/transactions?type=payment");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.every((t: { type: string }) => t.type === "payment"), "all results should be type=payment");
  });

  it("filters by currency correctly", async () => {
    const { status, data } = await api("GET", "/api/transactions?currency=USD");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.every((t: { currency: string }) => t.currency === "USD"), "all results should be USD");
  });
});

// ── 6, 7, 8: Audit log entries created by key actions ───────────────────────

describe("Audit log entries", () => {
  it("POST /api/clients/[id]/credit — creates audit log entry", async () => {
    const before = new Date();
    const { status } = await api("POST", `/api/clients/${testClientId}/credit`, {
      amount: 50, currency: "USD", is_crypto: false,
    });
    assert.equal(status, 201, "credit should return 201");

    // Give async write a moment, then verify via API
    await new Promise((r) => setTimeout(r, 500));
    const { data: logs } = await api("GET", "/api/audit-logs");
    const entry = logs.find((l: { action: string; created_at: string }) =>
      l.action === "balance_credited" && new Date(l.created_at) >= before
    );
    assert.ok(entry, "audit log entry 'balance_credited' should exist after credit");
  });

  it("POST /api/topup-requests/[id]/execute — creates audit log entry", async () => {
    const { data: req } = await api("POST", "/api/topup-requests", {
      client_id: testClientId, ad_account_id: testAdAccountId, amount: 20, currency: "USD",
    });
    assert.ok(req?.id, "should create topup request");

    const before = new Date();
    const { status } = await api("POST", `/api/topup-requests/${req.id}/execute`, {});
    assert.equal(status, 200, "execute should return 200");

    await new Promise((r) => setTimeout(r, 500));
    const { data: logs } = await api("GET", "/api/audit-logs");
    const entry = logs.find((l: { action: string; created_at: string }) =>
      l.action === "topup_executed" && new Date(l.created_at) >= before
    );
    assert.ok(entry, "audit log entry 'topup_executed' should exist after execute");
  });

  it("POST /api/topup-requests/[id]/reject — creates audit log entry", async () => {
    // Create a request with insufficient balance so it stays in insufficient_funds state
    const { data: req } = await api("POST", "/api/topup-requests", {
      client_id: testClientId, ad_account_id: testAdAccountId, amount: 99999, currency: "USD",
    });
    assert.ok(req?.id, "should create topup request");

    const before = new Date();
    const { status } = await api("POST", `/api/topup-requests/${req.id}/reject`, {
      notes: "Test rejection",
    });
    assert.equal(status, 200, "reject should return 200");

    await new Promise((r) => setTimeout(r, 500));
    const { data: logs } = await api("GET", "/api/audit-logs");
    const entry = logs.find((l: { action: string; created_at: string }) =>
      l.action === "topup_rejected" && new Date(l.created_at) >= before
    );
    assert.ok(entry, "audit log entry 'topup_rejected' should exist after reject");
  });
});

// ── 9: Dashboard ─────────────────────────────────────────────────────────────

describe("GET /api/dashboard", () => {
  it("returns KPI data with expected structure", async () => {
    const { status, data } = await api("GET", "/api/dashboard");
    assert.equal(status, 200, JSON.stringify(data));
    assert.ok("kpis" in data, "should have kpis");
    assert.ok("daily_volume" in data, "should have daily_volume");
    assert.ok("platform_volume" in data, "should have platform_volume");
    assert.ok("recent_transactions" in data, "should have recent_transactions");
    assert.ok(typeof data.kpis.total_wallet_balance === "number", "total_wallet_balance should be number");
    assert.ok(typeof data.kpis.active_clients === "number", "active_clients should be number");
    assert.ok(typeof data.kpis.pending_topups === "number", "pending_topups should be number");
    assert.ok(Array.isArray(data.daily_volume), "daily_volume should be array");
    assert.ok(Array.isArray(data.recent_transactions), "recent_transactions should be array");
  });
});

// ── 10 & 11: Settings ────────────────────────────────────────────────────────

describe("GET /api/settings + PATCH /api/settings", () => {
  it("GET /api/settings — returns agency settings object", async () => {
    const { status, data } = await api("GET", "/api/settings");
    assert.equal(status, 200, JSON.stringify(data));
    assert.ok("agency_name" in data, "should have agency_name");
    assert.ok("iban_usd" in data, "should have iban_usd");
    assert.ok("iban_eur" in data, "should have iban_eur");
  });

  it("PATCH /api/settings — updates settings correctly", async () => {
    const uniqueName = `Test Agency ${Date.now()}`;
    const { status, data } = await api("PATCH", "/api/settings", {
      agency_name: uniqueName,
    });
    assert.equal(status, 200, JSON.stringify(data));
    assert.equal(data.agency_name, uniqueName, "agency_name should be updated");

    // Verify the update persists via GET
    const { data: fetched } = await api("GET", "/api/settings");
    assert.equal(fetched.agency_name, uniqueName, "updated name should persist");
  });
});
