/**
 * Sprint 9 integration tests — Affiliate Portal APIs
 * Requires dev server at http://localhost:3000
 * Run: npm run test:sprint9
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { encode } from "next-auth/jwt";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and } from "drizzle-orm";
import { affiliates, clients, affiliate_commissions } from "../db/schema";

const BASE = "http://localhost:3000";
const COOKIE_NAME = "authjs.session-token";
const SALT = COOKIE_NAME;

let affiliateCookie = "";
let agencyCookie = "";
let affiliateId = "";
let testClientId = "";

// ── Auth helpers ─────────────────────────────────────────────────────────────
async function setupAffiliateCookie() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const [affiliate] = await db
    .select({ id: affiliates.id, name: affiliates.name, email: affiliates.email })
    .from(affiliates)
    .where(eq(affiliates.email, "affiliate@reward-agency.com"))
    .limit(1);

  if (!affiliate) throw new Error("Test affiliate not found — run db:seed first");
  affiliateId = affiliate.id;

  const token = await encode({
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
  affiliateCookie = `${COOKIE_NAME}=${token}`;
}

async function setupAgencyCookie() {
  // Use a fake admin JWT for agency auth
  const token = await encode({
    token: {
      sub: "00000000-0000-0000-0000-000000000001",
      id: "00000000-0000-0000-0000-000000000001",
      name: "Test Admin",
      email: "admin@reward-agency.com",
      role: "admin",
      userType: "agency",
    },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: SALT,
  });
  agencyCookie = `${COOKIE_NAME}=${token}`;
}

// ── Request helpers ───────────────────────────────────────────────────────────
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

  // Clean up test clients
  if (testClientId) {
    await db.delete(clients).where(eq(clients.id, testClientId));
    testClientId = "";
  }

  // Clean up any test commissions
  await db.delete(affiliate_commissions).where(
    and(
      eq(affiliate_commissions.affiliate_id, affiliateId),
      eq(affiliate_commissions.period_year, 2099)
    )
  );
}

// ── Test suite ────────────────────────────────────────────────────────────────
describe("Sprint 9 — Affiliate Portal APIs", () => {
  before(async () => {
    await Promise.all([setupAffiliateCookie(), setupAgencyCookie()]);
  });

  after(cleanup);

  describe("GET /api/affiliate/dashboard", () => {
    it("returns 200 with KPI fields for affiliate", async () => {
      const { status, data } = await api("GET", "/api/affiliate/dashboard", affiliateCookie);
      assert.equal(status, 200);
      assert.ok("total_clients" in data, "missing total_clients");
      assert.ok("active_clients" in data, "missing active_clients");
      assert.ok("current_month_commission" in data, "missing current_month_commission");
      assert.ok("total_paid" in data, "missing total_paid");
      assert.ok(Array.isArray(data.monthly_chart), "monthly_chart should be array");
      assert.ok(Array.isArray(data.recent_clients), "recent_clients should be array");
    });

    it("returns 403 for agency user", async () => {
      const { status } = await api("GET", "/api/affiliate/dashboard", agencyCookie);
      assert.equal(status, 403);
    });

    it("returns 401 without auth", async () => {
      const res = await fetch(`${BASE}/api/affiliate/dashboard`);
      assert.equal(res.status, 401);
    });

    it("recent_clients never includes wallet_balance", async () => {
      const { data } = await api("GET", "/api/affiliate/dashboard", affiliateCookie);
      for (const client of data.recent_clients ?? []) {
        assert.ok(!("wallet_balance" in client), "wallet_balance must not be in recent_clients");
        assert.ok(!("cached_balance" in client), "cached_balance must not be in recent_clients");
      }
    });
  });

  describe("GET /api/affiliate/clients", () => {
    it("returns 200 with array for affiliate", async () => {
      const { status, data } = await api("GET", "/api/affiliate/clients", affiliateCookie);
      assert.equal(status, 200);
      assert.ok(Array.isArray(data));
    });

    it("returns 403 for agency user", async () => {
      const { status } = await api("GET", "/api/affiliate/clients", agencyCookie);
      assert.equal(status, 403);
    });

    it("never includes wallet_balance field", async () => {
      const { data } = await api("GET", "/api/affiliate/clients", affiliateCookie);
      for (const c of data ?? []) {
        assert.ok(!("wallet_balance" in c), "wallet_balance must not be exposed");
        assert.ok(!("cached_balance" in c), "cached_balance must not be exposed");
        assert.ok(!("transactions" in c), "transactions must not be exposed");
        assert.ok(!("crypto_fee_rate" in c), "crypto_fee_rate must not be exposed");
      }
    });

    it("only returns clients belonging to the affiliate", async () => {
      const sql = neon(process.env.DATABASE_URL!);
      const db = drizzle(sql);

      // Insert a test client linked to this affiliate
      const [inserted] = await db
        .insert(clients)
        .values({
          client_code: "RWD-TEST9",
          name: "Sprint9 Test Client",
          email: "sprint9-test@example.com",
          company: "Test Co",
          balance_model: "classic",
          affiliate_id: affiliateId,
        })
        .returning({ id: clients.id });
      testClientId = inserted.id;

      const { data } = await api("GET", "/api/affiliate/clients", affiliateCookie);
      const ids = (data as { id: string }[]).map((c) => c.id);
      assert.ok(ids.includes(testClientId), "should include affiliated client");

      // All returned clients should belong to this affiliate
      const rows = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.affiliate_id, affiliateId));
      const affiliateClientIds = new Set(rows.map((r) => r.id));
      for (const id of ids) {
        assert.ok(affiliateClientIds.has(id), `client ${id} does not belong to this affiliate`);
      }
    });
  });

  describe("GET /api/affiliate/commissions", () => {
    it("returns 200 with array for affiliate", async () => {
      const { status, data } = await api("GET", "/api/affiliate/commissions", affiliateCookie);
      assert.equal(status, 200);
      assert.ok(Array.isArray(data));
    });

    it("returns 403 for agency user", async () => {
      const { status } = await api("GET", "/api/affiliate/commissions", agencyCookie);
      assert.equal(status, 403);
    });

    it("never includes internal financial fields", async () => {
      const { data } = await api("GET", "/api/affiliate/commissions", affiliateCookie);
      for (const c of data ?? []) {
        assert.ok(!("total_supplier_fees" in c), "total_supplier_fees must not be exposed");
        assert.ok(!("total_profit_net" in c), "total_profit_net must not be exposed");
        assert.ok(!("total_commissions_gross" in c), "total_commissions_gross must not be exposed");
        assert.ok(!("commission_rate" in c), "commission_rate must not be exposed");
      }
    });
  });

  describe("GET /api/affiliate/profile", () => {
    it("returns 200 with profile for affiliate", async () => {
      const { status, data } = await api("GET", "/api/affiliate/profile", affiliateCookie);
      assert.equal(status, 200);
      assert.equal(data.email, "affiliate@reward-agency.com");
      assert.ok("affiliate_code" in data);
      assert.ok("commission_rate" in data);
      assert.ok(!("password_hash" in data), "password_hash must not be returned");
    });

    it("returns 403 for agency user", async () => {
      const { status } = await api("GET", "/api/affiliate/profile", agencyCookie);
      assert.equal(status, 403);
    });
  });

  describe("PATCH /api/affiliate/profile", () => {
    it("updates allowed fields (name, company)", async () => {
      const { status, data } = await api("PATCH", "/api/affiliate/profile", affiliateCookie, {
        name: "Alice Updated",
        company: "Updated Media",
      });
      assert.equal(status, 200);
      assert.equal(data.name, "Alice Updated");
      assert.equal(data.company, "Updated Media");

      // Restore original values
      await api("PATCH", "/api/affiliate/profile", affiliateCookie, {
        name: "Alice Affiliate",
        company: "Alice Media",
      });
    });

    it("updates billing_address and billing_vat", async () => {
      const { status, data } = await api("PATCH", "/api/affiliate/profile", affiliateCookie, {
        billing_address: "123 Test Street",
        billing_vat: "FR123456",
      });
      assert.equal(status, 200);
      assert.equal(data.billing_address, "123 Test Street");
      assert.equal(data.billing_vat, "FR123456");
    });

    it("cannot update commission_rate (field is ignored)", async () => {
      const before = await api("GET", "/api/affiliate/profile", affiliateCookie);
      const original_rate = before.data.commission_rate;

      // Attempt to send commission_rate — should be silently ignored (no allowed field)
      const { status } = await api("PATCH", "/api/affiliate/profile", affiliateCookie, {
        commission_rate: "99.99",
      });
      // Should fail because no valid fields to update
      assert.equal(status, 400);

      const after = await api("GET", "/api/affiliate/profile", affiliateCookie);
      assert.equal(after.data.commission_rate, original_rate);
    });

    it("returns 400 with empty body", async () => {
      const { status } = await api("PATCH", "/api/affiliate/profile", affiliateCookie, {});
      assert.equal(status, 400);
    });

    it("returns 403 for agency user", async () => {
      const { status } = await api("PATCH", "/api/affiliate/profile", agencyCookie, { name: "Hack" });
      assert.equal(status, 403);
    });
  });
});
