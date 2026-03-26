/**
 * Sprint 7 integration tests — Affiliates + Hybrid Commission System
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
import { eq } from "drizzle-orm";
import {
  users, affiliates, clients, transactions, suppliers,
  supplier_sub_accounts, supplier_platform_fees, ad_accounts,
} from "../db/schema";

const BASE = "http://localhost:3000";
const COOKIE_NAME = "authjs.session-token";

let adminCookie = "";

let testAffiliateId = "";
let testAffiliateCode = "";
let testClientId = "";      // set by onboarding test
let testCommissionId = "";  // set by commission auto-update test (finalized record)

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
    await db2.delete(transactions).where(eq(transactions.client_id, testClientId)).catch(() => {});
    await db2.delete(clients).where(eq(clients.id, testClientId)).catch(() => {});
  }
  if (testAffiliateId) {
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
    assert.equal(status, 201);
    const sql = neon(process.env.DATABASE_URL!);
    const db2 = drizzle(sql);
    await db2.delete(transactions).where(eq(transactions.client_id, (await db2.select({ id: clients.id }).from(clients).where(eq(clients.email, "s7noauth@test.com")).limit(1))[0]?.id ?? "00000000-0000-0000-0000-000000000000")).catch(() => {});
    await db2.delete(clients).where(eq(clients.email, "s7noauth@test.com")).catch(() => {});
  });
});

// ── 4: Commission auto-update on top-up execution ─────────────────────────────

describe("Affiliate commission auto-update on top-up execution", () => {
  let supplierId = "";
  let subAccountId = "";
  let adAccountId = "";
  let previewCommId = "";
  let testCommClientId = "";

  before(async () => {
    // Create a dedicated client with platform fees linked to this affiliate
    const { data: clientRes } = await api("POST", "/api/clients", {
      name: "S7 Comm Client",
      email: "s7commclient@test.com",
      company: "S7 Comm Co",
      balance_model: "classic",
      billing_currency: "USD",
      affiliate_id: testAffiliateId,
      client_platform_fees: { meta: 5.0, google: 0, tiktok: 0, snapchat: 0, linkedin: 0 },
    });
    testCommClientId = clientRes.client.id;

    // Credit $500
    await api("POST", `/api/clients/${testCommClientId}/credit`, {
      amount: 500, currency: "USD", is_crypto: false,
    });

    // Create supplier with 2% meta fee
    const { data: sup } = await api("POST", "/api/suppliers", {
      name: "S7CommSup",
      contact_email: "s7commsup@test.com",
    });
    supplierId = sup.id;

    const { data: sub } = await api("POST", `/api/suppliers/${supplierId}/sub-accounts`, {
      name: "S7CommSub",
      platform_fees: { meta: 2.0 },
    });
    subAccountId = sub.id;

    // Create ad account for testCommClientId
    const { data: adAcc } = await api("POST", "/api/ad-accounts", {
      client_id: testCommClientId,
      supplier_sub_account_id: subAccountId,
      platform: "meta",
      account_id: "act_s7comm",
      account_name: "S7 Comm Meta",
    });
    adAccountId = adAcc.id;
  });

  after(async () => {
    const sql2 = neon(process.env.DATABASE_URL!);
    const db2 = drizzle(sql2);
    if (testCommClientId) {
      await db2.delete(transactions).where(eq(transactions.client_id, testCommClientId)).catch(() => {});
      await db2.delete(clients).where(eq(clients.id, testCommClientId)).catch(() => {});
    }
    if (supplierId) {
      const subs = await db2.select({ id: supplier_sub_accounts.id })
        .from(supplier_sub_accounts)
        .where(eq(supplier_sub_accounts.supplier_id, supplierId));
      for (const sub of subs) {
        await db2.delete(supplier_platform_fees).where(eq(supplier_platform_fees.supplier_sub_account_id, sub.id)).catch(() => {});
      }
      await db2.delete(supplier_sub_accounts).where(eq(supplier_sub_accounts.supplier_id, supplierId)).catch(() => {});
      await db2.delete(suppliers).where(eq(suppliers.id, supplierId)).catch(() => {});
    }
  });

  it("executing a top up auto-creates a 'preview' commission record", async () => {
    const { data: req } = await api("POST", "/api/topup-requests", {
      client_id: testCommClientId,
      ad_account_id: adAccountId,
      amount: 100,
      currency: "USD",
    });
    assert.ok(req?.id, "topup request should be created");

    const { status: execStatus, data: execData } = await api("POST", `/api/topup-requests/${req.id}/execute`, {});
    assert.equal(execStatus, 200, JSON.stringify(execData));

    const { status, data: commissions } = await api("GET", `/api/affiliates/${testAffiliateId}/commissions`);
    assert.equal(status, 200);
    assert.ok(Array.isArray(commissions));

    const today = new Date();
    const preview = commissions.find((c: { status: string; period_year: number; period_month: number }) =>
      c.status === "preview" &&
      c.period_year === today.getFullYear() &&
      c.period_month === today.getMonth() + 1
    );
    assert.ok(preview, "preview commission record should be auto-created");
    // 5% of 100 = 5.00 gross commission
    assert.equal(parseFloat(preview.total_commissions_gross), 5.0, "gross = 5% of 100 = 5.00");
    // 2% of 100 = 2.00 supplier fee
    assert.equal(parseFloat(preview.total_supplier_fees), 2.0, "supplier_fee = 2% of 100 = 2.00");
    // profit = 5 - 2 = 3.00
    assert.equal(parseFloat(preview.total_profit_net), 3.0, "profit_net = 5 - 2 = 3.00");
    // commission = 3 × 15% (rate updated in PATCH test) = 0.45
    assert.ok(Math.abs(parseFloat(preview.commission_amount) - 0.45) < 0.01, "commission = 3 × 15% = 0.45");
    previewCommId = preview.id;
    testCommissionId = preview.id;
  });

  it("executing second top up increments the existing 'preview' record", async () => {
    const { data: req } = await api("POST", "/api/topup-requests", {
      client_id: testCommClientId,
      ad_account_id: adAccountId,
      amount: 100,
      currency: "USD",
    });
    const { status: execStatus } = await api("POST", `/api/topup-requests/${req.id}/execute`, {});
    assert.equal(execStatus, 200);

    const { data: commissions } = await api("GET", `/api/affiliates/${testAffiliateId}/commissions`);
    const preview = commissions.find((c: { id: string }) => c.id === previewCommId);
    assert.ok(preview, "same preview record should be updated (not a new record)");
    assert.equal(parseFloat(preview.total_commissions_gross), 10.0, "gross = 5+5 = 10.00");
    assert.equal(parseFloat(preview.total_supplier_fees), 4.0, "supplier_fees = 2+2 = 4.00");
    assert.equal(parseFloat(preview.total_profit_net), 6.0, "profit_net = 10-4 = 6.00");
    assert.ok(Math.abs(parseFloat(preview.commission_amount) - 0.90) < 0.01, "commission = 6 × 15% = 0.90");
  });

  it("PATCH /api/affiliate-commissions/[id]/finalize changes status to 'calculated'", async () => {
    const { status, data } = await api("PATCH", `/api/affiliate-commissions/${previewCommId}/finalize`);
    assert.equal(status, 200, JSON.stringify(data));
    assert.equal(data.status, "calculated");
    assert.ok(data.calculated_at, "should set calculated_at");
  });

  it("returns 400 when finalizing a non-preview record", async () => {
    const { status } = await api("PATCH", `/api/affiliate-commissions/${previewCommId}/finalize`);
    assert.equal(status, 400, "cannot finalize a non-preview record");
  });

  it("executing top up after finalize does NOT modify the 'calculated' record", async () => {
    const { data: req } = await api("POST", "/api/topup-requests", {
      client_id: testCommClientId,
      ad_account_id: adAccountId,
      amount: 100,
      currency: "USD",
    });
    const { status: execStatus } = await api("POST", `/api/topup-requests/${req.id}/execute`, {});
    assert.equal(execStatus, 200);

    const { data: commissions } = await api("GET", `/api/affiliates/${testAffiliateId}/commissions`);
    const finalized = commissions.find((c: { id: string }) => c.id === previewCommId);
    assert.ok(finalized, "finalized record should still exist");
    assert.equal(finalized.status, "calculated", "status should remain 'calculated'");
    assert.equal(parseFloat(finalized.total_commissions_gross), 10.0, "finalized totals should not change");
  });
});

// ── 5: Commission list ────────────────────────────────────────────────────────

describe("GET /api/affiliates/[id]/commissions", () => {
  it("returns list of commissions with status field", async () => {
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
  it("marks a 'calculated' commission as paid", async () => {
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
