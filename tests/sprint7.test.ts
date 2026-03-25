/**
 * Sprint 7 integration tests
 * Requires dev server at http://localhost:3000
 * Run: npm run test:sprint7
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { encode } from "next-auth/jwt";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and } from "drizzle-orm";
import { users, affiliates, clients, affiliate_commissions } from "../db/schema";

const BASE = "http://localhost:3000";
const COOKIE_NAME = "authjs.session-token";

let adminCookie = "";

let testAffiliateId = "";
let testAffiliateCode = "";
let testClientId = "";
let testCommissionId = "";

async function setupAuth() {
  const sql = neon(process.env.DATABASE_URL!);
  const db2 = drizzle(sql);

  const [admin] = await db2.select().from(users).where(eq(users.email, "admin@reward-agency.com")).limit(1);
  if (!admin) throw new Error("Admin user not found");

  adminCookie = `${COOKIE_NAME}=${await encode({
    token: { sub: admin.id, id: admin.id, name: admin.name, email: admin.email, role: "admin", userType: "agency" },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: COOKIE_NAME,
  })}`;
}

async function cleanup() {
  const sql = neon(process.env.DATABASE_URL!);
  const db2 = drizzle(sql);

  if (testClientId) {
    await db2.delete(clients).where(eq(clients.id, testClientId)).catch(() => {});
  }
  if (testAffiliateId) {
    // commissions cascade on affiliate delete
    await db2.delete(affiliates).where(eq(affiliates.id, testAffiliateId)).catch(() => {});
  }
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

before(async () => {
  await setupAuth();
  await cleanup();
});

after(async () => {
  await cleanup();
});

// ── 1 & 2: Affiliate CRUD ─────────────────────────────────────────────────────

describe("POST /api/affiliates", () => {
  it("creates a new affiliate (admin only)", async () => {
    const { status, data } = await api("POST", "/api/affiliates", {
      name: "Sprint7 Affiliate",
      email: "s7aff@test.com",
      company: "S7 Co",
      commission_rate: 10,
    });
    assert.equal(status, 201, JSON.stringify(data));
    assert.ok(data.id, "should return id");
    assert.equal(data.name, "Sprint7 Affiliate");
    assert.ok(data.affiliate_code.startsWith("AFF-"), "should have AFF- code");
    assert.ok(data.referral_link.includes("/onboarding?ref="), "should have referral link");
    testAffiliateId = data.id;
    testAffiliateCode = data.affiliate_code;
  });

  it("returns 400 for duplicate email", async () => {
    const { status } = await api("POST", "/api/affiliates", {
      name: "Duplicate",
      email: "s7aff@test.com",
      company: "Dup Co",
      commission_rate: 5,
    });
    assert.equal(status, 400);
  });
});

describe("GET /api/affiliates", () => {
  it("returns full list with clients_count and commissions_paid", async () => {
    const { status, data } = await api("GET", "/api/affiliates");
    assert.equal(status, 200, JSON.stringify(data));
    assert.ok(Array.isArray(data));
    const aff = data.find((a: { id: string }) => a.id === testAffiliateId);
    assert.ok(aff, "created affiliate should be in list");
    assert.ok("clients_count" in aff, "should have clients_count");
    assert.ok("commissions_paid" in aff, "should have commissions_paid");
  });
});

describe("PATCH /api/affiliates/[id]", () => {
  it("updates affiliate commission rate", async () => {
    const { status, data } = await api("PATCH", `/api/affiliates/${testAffiliateId}`, {
      commission_rate: 15,
    });
    assert.equal(status, 200, JSON.stringify(data));
    assert.equal(parseFloat(data.commission_rate), 15);
  });
});

// ── 3: Public onboarding ──────────────────────────────────────────────────────

describe("POST /api/onboarding (public)", () => {
  it("creates a client via affiliate referral link", async () => {
    const { status, data } = await fetch(`${BASE}/api/onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "S7 Onboard Client",
        email: "s7onboard@test.com",
        company: "S7 Onboard Co",
        password: "TestPass123!",
        affiliate_code: testAffiliateCode,
      }),
    }).then(async (r) => ({ status: r.status, data: await r.json() }));

    assert.equal(status, 201, JSON.stringify(data));
    assert.ok(data.id, "should return id");
    assert.ok(data.client_code.startsWith("RWD-"), "should have RWD- code");
    testClientId = data.id;
  });

  it("returns 400 for duplicate email", async () => {
    const { status } = await fetch(`${BASE}/api/onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dup",
        email: "s7onboard@test.com",
        company: "Dup",
        password: "TestPass123!",
      }),
    }).then(async (r) => ({ status: r.status, data: await r.json() }));
    assert.equal(status, 400);
  });

  it("requires no auth (cookie not set)", async () => {
    // This test verifies the endpoint works without auth cookie
    const { status } = await fetch(`${BASE}/api/onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "NoAuth Test",
        email: "s7noauth@test.com",
        company: "NoAuth Co",
        password: "TestPass123!",
      }),
    }).then(async (r) => ({ status: r.status, data: await r.json() }));
    // 201 = success without auth
    assert.equal(status, 201);

    // cleanup this client
    const sql = neon(process.env.DATABASE_URL!);
    const db2 = drizzle(sql);
    await db2.delete(clients).where(eq(clients.email, "s7noauth@test.com")).catch(() => {});
  });
});

// ── 4: Commission calculation ─────────────────────────────────────────────────

describe("POST /api/affiliates/[id]/commissions/calculate", () => {
  it("calculates commission for a period with full breakdown", async () => {
    const { status, data } = await api("POST", `/api/affiliates/${testAffiliateId}/commissions/calculate`, {
      year: 2026,
      month: 1,
    });
    assert.equal(status, 201, JSON.stringify(data));
    assert.ok(data.id, "should return commission record");
    assert.equal(data.period_year, 2026);
    assert.equal(data.period_month, 1);
    // New formula fields
    assert.ok("total_commissions_gross" in data, "should have total_commissions_gross");
    assert.ok("total_supplier_fees" in data, "should have total_supplier_fees");
    assert.ok("total_crypto_fees" in data, "should have total_crypto_fees");
    assert.ok("total_bank_fees" in data, "should have total_bank_fees");
    assert.ok("total_profit_net" in data, "should have total_profit_net");
    assert.ok("commission_amount" in data, "should have commission_amount");
    // Verify formula: profit_net = gross - supplier_fees - crypto_fees - bank_fees
    const gross = parseFloat(data.total_commissions_gross);
    const supFees = parseFloat(data.total_supplier_fees);
    const cryptoFees = parseFloat(data.total_crypto_fees);
    const bankFees = parseFloat(data.total_bank_fees);
    const profitNet = parseFloat(data.total_profit_net);
    assert.ok(Math.abs(profitNet - (gross - supFees - cryptoFees - bankFees)) < 0.01, "profit_net formula should be correct");
    // commission_amount = profit_net × rate%
    const rate = parseFloat(data.commission_rate);
    const commissionAmount = parseFloat(data.commission_amount);
    assert.ok(Math.abs(commissionAmount - profitNet * rate / 100) < 0.01, "commission_amount formula should be correct");
    testCommissionId = data.id;
  });

  it("recalculates (upserts) for same period", async () => {
    const { status, data } = await api("POST", `/api/affiliates/${testAffiliateId}/commissions/calculate`, {
      year: 2026,
      month: 1,
    });
    assert.equal(status, 201, JSON.stringify(data));
    assert.equal(data.id, testCommissionId, "should return same record (upsert)");
  });
});

// ── 5: Commission list ────────────────────────────────────────────────────────

describe("GET /api/affiliates/[id]/commissions", () => {
  it("returns list of commissions", async () => {
    const { status, data } = await api("GET", `/api/affiliates/${testAffiliateId}/commissions`);
    assert.equal(status, 200, JSON.stringify(data));
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0, "should have at least one commission record");
    assert.ok("commission_amount" in data[0]);
    assert.ok("status" in data[0]);
  });
});

// ── 6: Mark paid ──────────────────────────────────────────────────────────────

describe("PATCH /api/affiliate-commissions/[id]/mark-paid", () => {
  it("marks commission as paid", async () => {
    const { status, data } = await api("PATCH", `/api/affiliate-commissions/${testCommissionId}/mark-paid`);
    assert.equal(status, 200, JSON.stringify(data));
    assert.equal(data.status, "paid");
    assert.ok(data.paid_at, "should have paid_at timestamp");
  });

  it("returns 400 if already paid", async () => {
    const { status } = await api("PATCH", `/api/affiliate-commissions/${testCommissionId}/mark-paid`);
    assert.equal(status, 400);
  });
});

// ── 7: Affiliate clients list ─────────────────────────────────────────────────

describe("GET /api/affiliates/[id]/clients", () => {
  it("returns clients referred by affiliate", async () => {
    const { status, data } = await api("GET", `/api/affiliates/${testAffiliateId}/clients`);
    assert.equal(status, 200, JSON.stringify(data));
    assert.ok(Array.isArray(data));
    const found = data.find((c: { id: string }) => c.id === testClientId);
    assert.ok(found, "onboarded client should appear in affiliate clients list");
  });
});
