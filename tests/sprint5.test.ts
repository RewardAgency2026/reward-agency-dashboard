/**
 * Sprint 5 integration tests — Top-Up Requests module
 * Requires dev server at http://localhost:3000
 * Run: npm run test:sprint5
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
  users, clients, suppliers, supplier_sub_accounts, supplier_platform_fees,
  ad_accounts, transactions, topup_requests,
} from "../db/schema";

const BASE = "http://localhost:3000";
const COOKIE_NAME = "authjs.session-token";
const SALT = COOKIE_NAME;

const TEST_CLIENT_EMAIL = "test-sprint5-client@example.com";
const TEST_CLIENT_EMAIL_POOR = "test-sprint5-poor@example.com";
const TEST_SUPPLIER_NAME = "Test Supplier Sprint5";

let authCookie = "";
let richClientId = "";   // has $1000 balance
let poorClientId = "";   // has $10 balance
let supplierId = "";
let subAccountId = "";
let adAccountId = "";
let adAccountPoorId = "";
let requestApprovedId = "";
let requestInsufficientId = "";

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

  // Delete topup requests for test clients
  for (const email of [TEST_CLIENT_EMAIL, TEST_CLIENT_EMAIL_POOR]) {
    const testClients = await db.select({ id: clients.id }).from(clients).where(eq(clients.email, email));
    for (const c of testClients) {
      await db.delete(topup_requests).where(eq(topup_requests.client_id, c.id)).catch(() => {});
      await db.delete(transactions).where(eq(transactions.client_id, c.id)).catch(() => {});
      await db.delete(ad_accounts).where(eq(ad_accounts.client_id, c.id)).catch(() => {});
    }
    await db.delete(clients).where(eq(clients.email, email)).catch(() => {});
  }

  // Delete test suppliers
  const testSuppliers = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.name, TEST_SUPPLIER_NAME));
  for (const s of testSuppliers) {
    await db.delete(ad_accounts).where(eq(ad_accounts.supplier_id, s.id)).catch(() => {});
    const subs = await db.select({ id: supplier_sub_accounts.id }).from(supplier_sub_accounts).where(eq(supplier_sub_accounts.supplier_id, s.id));
    for (const sa of subs) {
      await db.delete(supplier_platform_fees).where(eq(supplier_platform_fees.supplier_sub_account_id, sa.id)).catch(() => {});
    }
    await db.delete(supplier_sub_accounts).where(eq(supplier_sub_accounts.supplier_id, s.id)).catch(() => {});
    await db.delete(suppliers).where(eq(suppliers.id, s.id)).catch(() => {});
  }
}

before(async () => {
  await setupAuth();
  await cleanup();

  // Create test supplier + sub-account with 3% meta fee
  const { data: sup } = await api("POST", "/api/suppliers", {
    name: TEST_SUPPLIER_NAME,
    contact_email: "supplier-sprint5@example.com",
  });
  supplierId = sup.id;

  const { data: sub } = await api("POST", `/api/suppliers/${supplierId}/sub-accounts`, {
    name: "Sprint5 Sub",
    platform_fees: { meta: 3.0 },
  });
  subAccountId = sub.id;

  // Create rich client ($1000 balance)
  const { data: richClient } = await api("POST", "/api/clients", {
    name: "Rich Sprint5 Client",
    email: TEST_CLIENT_EMAIL,
    company: "Sprint5 Corp",
    balance_model: "classic",
    billing_currency: "USD",
  });
  richClientId = richClient.id;

  // Credit rich client $1000
  await api("POST", `/api/clients/${richClientId}/credit`, {
    amount: 1000,
    currency: "USD",
    is_crypto: false,
  });

  // Create poor client ($10 balance)
  const { data: poorClient } = await api("POST", "/api/clients", {
    name: "Poor Sprint5 Client",
    email: TEST_CLIENT_EMAIL_POOR,
    company: "Sprint5 Poor Corp",
    balance_model: "classic",
    billing_currency: "USD",
  });
  poorClientId = poorClient.id;

  // Credit poor client $10
  await api("POST", `/api/clients/${poorClientId}/credit`, {
    amount: 10,
    currency: "USD",
    is_crypto: false,
  });

  // Create ad account for rich client (5% agency fee, sub-account has 3% supplier fee)
  const { data: adAcc } = await api("POST", "/api/ad-accounts", {
    client_id: richClientId,
    supplier_sub_account_id: subAccountId,
    platform: "meta",
    account_id: "act_sprint5_rich",
    account_name: "Sprint5 Rich Meta",
    top_up_fee_rate: 5.0,
  });
  adAccountId = adAcc.id;

  // Create ad account for poor client
  const { data: adAccPoor } = await api("POST", "/api/ad-accounts", {
    client_id: poorClientId,
    supplier_sub_account_id: subAccountId,
    platform: "meta",
    account_id: "act_sprint5_poor",
    account_name: "Sprint5 Poor Meta",
    top_up_fee_rate: 5.0,
  });
  adAccountPoorId = adAccPoor.id;
});

after(async () => {
  await cleanup();
});

// ── Create requests ────────────────────────────────────────────────────────────
describe("POST /api/topup-requests — create", () => {
  it("creates request with status 'approved' when wallet is sufficient", async () => {
    const { status, data } = await api("POST", "/api/topup-requests", {
      client_id: richClientId,
      ad_account_id: adAccountId,
      amount: 100,
      currency: "USD",
    });
    assert.equal(status, 201, JSON.stringify(data));
    assert.equal(data.status, "approved");
    assert.equal(parseFloat(data.amount), 100);
    assert.ok(data.wallet_balance >= 100, "wallet_balance should be >= 100");
    requestApprovedId = data.id;
  });

  it("creates request with status 'insufficient_funds' when wallet is insufficient", async () => {
    const { status, data } = await api("POST", "/api/topup-requests", {
      client_id: poorClientId,
      ad_account_id: adAccountPoorId,
      amount: 500,
      currency: "USD",
    });
    assert.equal(status, 201, JSON.stringify(data));
    assert.equal(data.status, "insufficient_funds");
    requestInsufficientId = data.id;
  });

  it("rejects invalid client_id", async () => {
    const { status } = await api("POST", "/api/topup-requests", {
      client_id: "00000000-0000-0000-0000-000000000000",
      ad_account_id: adAccountId,
      amount: 100,
      currency: "USD",
    });
    assert.equal(status, 404);
  });

  it("rejects missing amount", async () => {
    const { status } = await api("POST", "/api/topup-requests", {
      client_id: richClientId,
      ad_account_id: adAccountId,
      currency: "USD",
    });
    assert.equal(status, 400);
  });
});

// ── List + filter ──────────────────────────────────────────────────────────────
describe("GET /api/topup-requests — list and filter", () => {
  it("returns all requests with joined fields", async () => {
    const { status, data } = await api("GET", "/api/topup-requests");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    const found = data.find((r: { id: string }) => r.id === requestApprovedId);
    assert.ok(found, "approved request not in list");
    assert.ok("client_name" in found);
    assert.ok("ad_account_platform" in found);
    assert.ok("supplier_name" in found);
    assert.ok("wallet_balance" in found);
  });

  it("filters by status=approved", async () => {
    const { status, data } = await api("GET", "/api/topup-requests?status=approved");
    assert.equal(status, 200);
    assert.ok(data.every((r: { status: string }) => r.status === "approved"), "all results should be approved");
    const found = data.find((r: { id: string }) => r.id === requestApprovedId);
    assert.ok(found, "approved request not found in filtered list");
  });

  it("filters by status=insufficient_funds", async () => {
    const { status, data } = await api("GET", "/api/topup-requests?status=insufficient_funds");
    assert.equal(status, 200);
    const found = data.find((r: { id: string }) => r.id === requestInsufficientId);
    assert.ok(found, "insufficient_funds request not found");
  });

  it("filters by client_id", async () => {
    const { status, data } = await api("GET", `/api/topup-requests?client_id=${richClientId}`);
    assert.equal(status, 200);
    assert.ok(data.every((r: { client_id: string }) => r.client_id === richClientId));
  });
});

// ── Single request ─────────────────────────────────────────────────────────────
describe("GET /api/topup-requests/[id]", () => {
  it("returns single request with all fields", async () => {
    const { status, data } = await api("GET", `/api/topup-requests/${requestApprovedId}`);
    assert.equal(status, 200);
    assert.equal(data.id, requestApprovedId);
    assert.ok("wallet_balance" in data);
    assert.ok("supplier_fee_rate" in data);
    assert.ok("top_up_fee_rate" in data);
  });

  it("returns 404 for unknown ID", async () => {
    const { status } = await api("GET", "/api/topup-requests/00000000-0000-0000-0000-000000000000");
    assert.equal(status, 404);
  });
});

// ── Execute ────────────────────────────────────────────────────────────────────
describe("POST /api/topup-requests/[id]/execute", () => {
  it("executes request: creates transaction with correct fee snapshots", async () => {
    const { status, data } = await api("POST", `/api/topup-requests/${requestApprovedId}/execute`, {});
    assert.equal(status, 200, JSON.stringify(data));

    // Request updated to executed
    assert.equal(data.request.status, "executed");
    assert.ok(data.request.executed_at, "executed_at should be set");

    // Transaction created
    const txn = data.transaction;
    assert.ok(txn, "transaction should be returned");
    assert.equal(txn.type, "topup");
    assert.equal(parseFloat(txn.amount), 100);

    // Supplier fee: 3% of 100 = 3.00
    assert.equal(parseFloat(txn.supplier_fee_amount), 3.0, "supplier_fee_amount should be 3.00");
    assert.equal(parseFloat(txn.supplier_fee_rate_snapshot), 3.0, "supplier_fee_rate_snapshot should be 3.0");

    // Agency commission: 5% of 100 = 5.00
    assert.equal(parseFloat(txn.top_up_fee_amount), 5.0, "top_up_fee_amount should be 5.00");

    // Wallet balance returned and updated
    assert.ok(typeof data.wallet_balance === "number", "wallet_balance should be a number");
    assert.ok(data.wallet_balance < 1000, "wallet_balance should have decreased");
  });

  it("fails if wallet is insufficient (without force)", async () => {
    // requestInsufficientId has $10 balance, amount is $500
    const { status, data } = await api("POST", `/api/topup-requests/${requestInsufficientId}/execute`, {});
    assert.equal(status, 402, JSON.stringify(data));
    assert.ok("wallet_balance" in data);
  });

  it("fails with 409 if already executed", async () => {
    const { status } = await api("POST", `/api/topup-requests/${requestApprovedId}/execute`, {});
    assert.equal(status, 409);
  });
});

// ── Reject ─────────────────────────────────────────────────────────────────────
describe("POST /api/topup-requests/[id]/reject", () => {
  it("rejects an insufficient_funds request", async () => {
    const { status, data } = await api("POST", `/api/topup-requests/${requestInsufficientId}/reject`, {
      notes: "Client does not have sufficient funds",
    });
    assert.equal(status, 200, JSON.stringify(data));
    assert.equal(data.status, "rejected");
  });

  it("fails with 409 if already rejected", async () => {
    const { status } = await api("POST", `/api/topup-requests/${requestInsufficientId}/reject`, {});
    assert.equal(status, 409);
  });

  it("fails with 409 if already executed", async () => {
    const { status } = await api("POST", `/api/topup-requests/${requestApprovedId}/reject`, {});
    assert.equal(status, 409);
  });
});
