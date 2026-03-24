/**
 * Sprint 6 integration tests
 * Run: npm run test:sprint6
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { encode } from "next-auth/jwt";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { users, clients, ad_accounts, suppliers, topup_requests, transactions } from "../db/schema";

const BASE = "http://localhost:3000";
const COOKIE_NAME = "authjs.session-token";

let adminCookie = "";
let teamCookie = "";

async function setupAuth() {
  const sql = neon(process.env.DATABASE_URL!);
  const db2 = drizzle(sql);

  const [admin] = await db2.select().from(users).where(eq(users.email, "admin@reward-agency.com")).limit(1);
  const [team] = await db2.select().from(users).where(eq(users.email, "team@reward-agency.com")).limit(1);
  if (!admin || !team) throw new Error("Test users not found");

  adminCookie = `${COOKIE_NAME}=${await encode({ token: { sub: admin.id, id: admin.id, name: admin.name, email: admin.email, role: "admin", userType: "agency" }, secret: process.env.NEXTAUTH_SECRET!, salt: COOKIE_NAME })}`;
  teamCookie = `${COOKIE_NAME}=${await encode({ token: { sub: team.id, id: team.id, name: team.name, email: team.email, role: "team", userType: "agency" }, secret: process.env.NEXTAUTH_SECRET!, salt: COOKIE_NAME })}`;
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

before(async () => { await setupAuth(); });

describe("GET /api/transactions", () => {
  it("returns transaction list", async () => {
    const { status, data } = await api("GET", "/api/transactions");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
  });

  it("filters by type", async () => {
    const { status, data } = await api("GET", "/api/transactions?type=payment");
    assert.equal(status, 200);
    assert.ok(data.every((t: { type: string }) => t.type === "payment"));
  });

  it("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/transactions`);
    assert.equal(res.status, 401);
  });
});

describe("GET /api/dashboard", () => {
  it("returns dashboard KPIs", async () => {
    const { status, data } = await api("GET", "/api/dashboard");
    assert.equal(status, 200);
    assert.ok("kpis" in data);
    assert.ok("daily_volume" in data);
    assert.ok("platform_volume" in data);
    assert.ok("recent_transactions" in data);
    assert.ok(typeof data.kpis.total_wallet_balance === "number");
    assert.ok(typeof data.kpis.active_clients === "number");
  });
});

describe("DELETE /api/topup-requests/[id] — admin only", () => {
  let testClientId = "";
  let testAdAccountId = "";
  let testSupplierId = "";
  let pendingRequestId = "";

  before(async () => {
    const { data: sup } = await api("POST", "/api/suppliers", { name: "Sprint6 Supplier", contact_email: "s6@test.com" });
    testSupplierId = sup.id;
    const { data: subAcc } = await api("POST", `/api/suppliers/${testSupplierId}/sub-accounts`, { name: "S6 Sub", platform_fees: { meta: 2.0 } });
    const { data: client } = await api("POST", "/api/clients", { name: "Sprint6 Client", email: "s6client@test.com", company: "S6 Co", balance_model: "classic", billing_currency: "USD" });
    testClientId = client.id;
    await api("POST", `/api/clients/${testClientId}/credit`, { amount: 500, currency: "USD", is_crypto: false });
    const { data: adAcc } = await api("POST", "/api/ad-accounts", { client_id: testClientId, supplier_sub_account_id: subAcc.id, platform: "meta", account_id: "act_s6", account_name: "Sprint6 Meta" });
    testAdAccountId = adAcc.id;
    const { data: req } = await api("POST", "/api/topup-requests", { client_id: testClientId, ad_account_id: testAdAccountId, amount: 100, currency: "USD" });
    pendingRequestId = req.id;
  });

  after(async () => {
    const sql = neon(process.env.DATABASE_URL!);
    const db2 = drizzle(sql);
    await db2.delete(topup_requests).where(eq(topup_requests.client_id, testClientId)).catch(() => {});
    await db2.delete(transactions).where(eq(transactions.client_id, testClientId)).catch(() => {});
    await db2.delete(ad_accounts).where(eq(ad_accounts.client_id, testClientId)).catch(() => {});
    await db2.delete(clients).where(eq(clients.id, testClientId)).catch(() => {});
    const subs = await db2.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.name, "Sprint6 Supplier"));
    for (const s of subs) await db2.delete(suppliers).where(eq(suppliers.id, s.id)).catch(() => {});
  });

  it("deletes a pending request as admin", async () => {
    const { status, data } = await api("DELETE", `/api/topup-requests/${pendingRequestId}`);
    assert.equal(status, 200, JSON.stringify(data));
    assert.ok(data.success);
  });

  it("returns 400 trying to delete executed request", async () => {
    await api("POST", `/api/clients/${testClientId}/credit`, { amount: 500, currency: "USD", is_crypto: false });
    const { data: req2 } = await api("POST", "/api/topup-requests", { client_id: testClientId, ad_account_id: testAdAccountId, amount: 50, currency: "USD" });
    await api("POST", `/api/topup-requests/${req2.id}/execute`, {});
    const { status } = await api("DELETE", `/api/topup-requests/${req2.id}`);
    assert.equal(status, 400);
  });
});

describe("GET /api/audit-logs", () => {
  it("returns audit logs for admin", async () => {
    const { status, data } = await api("GET", "/api/audit-logs");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
  });

  it("returns 401 without auth", async () => {
    const res = await fetch(`${BASE}/api/audit-logs`);
    assert.equal(res.status, 401);
  });
});

describe("GET /api/settings", () => {
  it("returns settings object", async () => {
    const { status, data } = await api("GET", "/api/settings");
    assert.equal(status, 200);
    assert.ok("agency_name" in data);
  });
});

describe("GET /api/users", () => {
  it("returns user list for admin", async () => {
    const { status, data } = await api("GET", "/api/users");
    assert.equal(status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0);
  });
});
