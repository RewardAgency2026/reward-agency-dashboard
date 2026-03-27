/**
 * Sprint 10 integration tests — Commission workflow (approve/reject/mark-paid/cron)
 * Requires dev server at http://localhost:3000
 * Run: npm run test:sprint10
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { encode } from "next-auth/jwt";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and } from "drizzle-orm";
import { affiliates, affiliate_commissions, users } from "../db/schema";

const BASE = "http://localhost:3000";
const COOKIE_NAME = "authjs.session-token";
const SALT = COOKIE_NAME;

let adminCookie = "";
let teamCookie = "";
let affiliateCookie = "";
let affiliateId = "";
let testCommissionId = "";

// ── Auth helpers ─────────────────────────────────────────────────────────────
async function setupCookies() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  // Get real admin user from DB
  const [admin] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.email, "admin@reward-agency.com"), eq(users.role, "admin")))
    .limit(1);

  if (!admin) throw new Error("Admin user not found — run db:seed first");

  const adminToken = await encode({
    token: {
      sub: admin.id,
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      userType: "agency",
    },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: SALT,
  });
  adminCookie = `${COOKIE_NAME}=${adminToken}`;

  // Get team user
  const [team] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(and(eq(users.email, "team@reward-agency.com"), eq(users.role, "team")))
    .limit(1);

  if (!team) throw new Error("Team user not found — run db:seed first");

  const teamToken = await encode({
    token: {
      sub: team.id,
      id: team.id,
      name: team.name,
      email: team.email,
      role: team.role,
      userType: "agency",
    },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: SALT,
  });
  teamCookie = `${COOKIE_NAME}=${teamToken}`;

  // Get affiliate
  const [affiliate] = await db
    .select({ id: affiliates.id, name: affiliates.name, email: affiliates.email })
    .from(affiliates)
    .where(eq(affiliates.email, "affiliate@reward-agency.com"))
    .limit(1);

  if (!affiliate) throw new Error("Test affiliate not found — run db:seed first");
  affiliateId = affiliate.id;

  const affiliateToken = await encode({
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
  affiliateCookie = `${COOKIE_NAME}=${affiliateToken}`;
}

async function createTestCommission(status: string): Promise<string> {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql);

  const [row] = await db
    .insert(affiliate_commissions)
    .values({
      affiliate_id: affiliateId,
      period_year: 2099,
      period_month: 1,
      clients_count: 1,
      total_topups: "1000.00",
      total_commissions_gross: "1000.00",
      total_supplier_fees: "50.00",
      total_profit_net: "950.00",
      commission_rate: "25.00",
      commission_amount: "237.50",
      status,
    })
    .returning({ id: affiliate_commissions.id });

  return row.id;
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

  await db.delete(affiliate_commissions).where(
    and(
      eq(affiliate_commissions.affiliate_id, affiliateId),
      eq(affiliate_commissions.period_year, 2099)
    )
  );
}

// ── Test suite ────────────────────────────────────────────────────────────────
describe("Sprint 10 — Commission Workflow", () => {
  before(async () => {
    await setupCookies();
  });

  after(cleanup);

  // ── pending-count ───────────────────────────────────────────────────────────
  describe("GET /api/affiliate-commissions/pending-count", () => {
    it("returns 200 with count for agency user", async () => {
      const { status, data } = await api("GET", "/api/affiliate-commissions/pending-count", adminCookie);
      assert.equal(status, 200);
      assert.ok("count" in data, "should have count field");
      assert.ok(typeof data.count === "number", "count should be a number");
    });

    it("returns 401 without auth", async () => {
      const res = await fetch(`${BASE}/api/affiliate-commissions/pending-count`);
      assert.equal(res.status, 401);
    });
  });

  // ── approve endpoint ────────────────────────────────────────────────────────
  describe("POST /api/affiliate-commissions/[id]/approve", () => {
    it("approves a pending_approval commission (admin only)", async () => {
      const id = await createTestCommission("pending_approval");
      testCommissionId = id;
      try {
        const { status, data } = await api("POST", `/api/affiliate-commissions/${id}/approve`, adminCookie);
        assert.equal(status, 200);
        assert.equal(data.status, "approved");
        assert.ok(data.approved_at, "approved_at should be set");
        assert.ok(data.approved_by, "approved_by should be set");
      } finally {
        const sql = neon(process.env.DATABASE_URL!);
        const db = drizzle(sql);
        await db.delete(affiliate_commissions).where(eq(affiliate_commissions.id, id));
      }
    });

    it("returns 403 for team role", async () => {
      const id = await createTestCommission("pending_approval");
      try {
        const { status } = await api("POST", `/api/affiliate-commissions/${id}/approve`, teamCookie);
        assert.equal(status, 403);
      } finally {
        const sql = neon(process.env.DATABASE_URL!);
        const db = drizzle(sql);
        await db.delete(affiliate_commissions).where(eq(affiliate_commissions.id, id));
      }
    });

    it("returns 403 for affiliate user", async () => {
      const id = await createTestCommission("pending_approval");
      try {
        const { status } = await api("POST", `/api/affiliate-commissions/${id}/approve`, affiliateCookie);
        assert.equal(status, 403);
      } finally {
        const sql = neon(process.env.DATABASE_URL!);
        const db = drizzle(sql);
        await db.delete(affiliate_commissions).where(eq(affiliate_commissions.id, id));
      }
    });

    it("returns 400 when trying to approve a preview record", async () => {
      const id = await createTestCommission("preview");
      try {
        const { status } = await api("POST", `/api/affiliate-commissions/${id}/approve`, adminCookie);
        assert.equal(status, 400);
      } finally {
        const sql = neon(process.env.DATABASE_URL!);
        const db = drizzle(sql);
        await db.delete(affiliate_commissions).where(eq(affiliate_commissions.id, id));
      }
    });

    it("returns 404 for non-existent id", async () => {
      const { status } = await api(
        "POST",
        "/api/affiliate-commissions/00000000-0000-0000-0000-000000000000/approve",
        adminCookie
      );
      assert.equal(status, 404);
    });
  });

  // ── reject (DELETE /approve) ────────────────────────────────────────────────
  describe("DELETE /api/affiliate-commissions/[id]/approve (reject)", () => {
    it("rejects a pending_approval record back to preview", async () => {
      const id = await createTestCommission("pending_approval");
      try {
        const { status, data } = await api("DELETE", `/api/affiliate-commissions/${id}/approve`, adminCookie);
        assert.equal(status, 200);
        assert.equal(data.status, "preview");
        assert.equal(data.approved_at, null);
        assert.equal(data.approved_by, null);
      } finally {
        const sql = neon(process.env.DATABASE_URL!);
        const db = drizzle(sql);
        await db.delete(affiliate_commissions).where(eq(affiliate_commissions.id, id));
      }
    });

    it("returns 403 for team role", async () => {
      const id = await createTestCommission("pending_approval");
      try {
        const { status } = await api("DELETE", `/api/affiliate-commissions/${id}/approve`, teamCookie);
        assert.equal(status, 403);
      } finally {
        const sql = neon(process.env.DATABASE_URL!);
        const db = drizzle(sql);
        await db.delete(affiliate_commissions).where(eq(affiliate_commissions.id, id));
      }
    });
  });

  // ── approve-all ─────────────────────────────────────────────────────────────
  describe("POST /api/affiliate-commissions/approve-all", () => {
    it("bulk-approves all pending_approval records (admin only)", async () => {
      // Create two pending records in different months to avoid unique constraint conflicts
      const sql = neon(process.env.DATABASE_URL!);
      const db = drizzle(sql);

      const [r1] = await db
        .insert(affiliate_commissions)
        .values({
          affiliate_id: affiliateId,
          period_year: 2099,
          period_month: 2,
          clients_count: 1,
          total_topups: "500.00",
          total_commissions_gross: "500.00",
          total_supplier_fees: "25.00",
          total_profit_net: "475.00",
          commission_rate: "25.00",
          commission_amount: "118.75",
          status: "pending_approval",
        })
        .returning({ id: affiliate_commissions.id });

      const [r2] = await db
        .insert(affiliate_commissions)
        .values({
          affiliate_id: affiliateId,
          period_year: 2099,
          period_month: 3,
          clients_count: 1,
          total_topups: "500.00",
          total_commissions_gross: "500.00",
          total_supplier_fees: "25.00",
          total_profit_net: "475.00",
          commission_rate: "25.00",
          commission_amount: "118.75",
          status: "pending_approval",
        })
        .returning({ id: affiliate_commissions.id });

      try {
        const { status, data } = await api("POST", "/api/affiliate-commissions/approve-all", adminCookie);
        assert.equal(status, 200);
        assert.ok(data.ok === true);
        assert.ok(typeof data.approved === "number");
        assert.ok(data.approved >= 2, `expected at least 2 approved, got ${data.approved}`);
      } finally {
        await db.delete(affiliate_commissions).where(eq(affiliate_commissions.id, r1.id));
        await db.delete(affiliate_commissions).where(eq(affiliate_commissions.id, r2.id));
      }
    });

    it("returns 403 for team role", async () => {
      const { status } = await api("POST", "/api/affiliate-commissions/approve-all", teamCookie);
      assert.equal(status, 403);
    });
  });

  // ── mark-paid ───────────────────────────────────────────────────────────────
  describe("PATCH /api/affiliate-commissions/[id]/mark-paid", () => {
    it("marks an approved commission as paid", async () => {
      const id = await createTestCommission("approved");
      try {
        const { status, data } = await api(
          "PATCH",
          `/api/affiliate-commissions/${id}/mark-paid`,
          adminCookie,
          { reference: "BANK-REF-001" }
        );
        assert.equal(status, 200);
        assert.equal(data.status, "paid");
        assert.ok(data.paid_at, "paid_at should be set");
        assert.equal(data.paid_reference, "BANK-REF-001");
      } finally {
        const sql = neon(process.env.DATABASE_URL!);
        const db = drizzle(sql);
        await db.delete(affiliate_commissions).where(eq(affiliate_commissions.id, id));
      }
    });

    it("returns 400 when trying to mark a pending_approval commission as paid", async () => {
      const id = await createTestCommission("pending_approval");
      try {
        const { status } = await api("PATCH", `/api/affiliate-commissions/${id}/mark-paid`, adminCookie);
        assert.equal(status, 400);
      } finally {
        const sql = neon(process.env.DATABASE_URL!);
        const db = drizzle(sql);
        await db.delete(affiliate_commissions).where(eq(affiliate_commissions.id, id));
      }
    });

    it("returns 400 when trying to mark a preview commission as paid", async () => {
      const id = await createTestCommission("preview");
      try {
        const { status } = await api("PATCH", `/api/affiliate-commissions/${id}/mark-paid`, adminCookie);
        assert.equal(status, 400);
      } finally {
        const sql = neon(process.env.DATABASE_URL!);
        const db = drizzle(sql);
        await db.delete(affiliate_commissions).where(eq(affiliate_commissions.id, id));
      }
    });

    it("returns 400 when already paid", async () => {
      const id = await createTestCommission("paid");
      try {
        const { status } = await api("PATCH", `/api/affiliate-commissions/${id}/mark-paid`, adminCookie);
        assert.equal(status, 400);
      } finally {
        const sql = neon(process.env.DATABASE_URL!);
        const db = drizzle(sql);
        await db.delete(affiliate_commissions).where(eq(affiliate_commissions.id, id));
      }
    });

    it("returns 403 for team role", async () => {
      const id = await createTestCommission("approved");
      try {
        const { status } = await api("PATCH", `/api/affiliate-commissions/${id}/mark-paid`, teamCookie);
        assert.equal(status, 403);
      } finally {
        const sql = neon(process.env.DATABASE_URL!);
        const db = drizzle(sql);
        await db.delete(affiliate_commissions).where(eq(affiliate_commissions.id, id));
      }
    });
  });

  // ── unique constraint ────────────────────────────────────────────────────────
  describe("Unique constraint — one row per affiliate+month", () => {
    it("prevents inserting a second row for the same affiliate+month", async () => {
      const sql = neon(process.env.DATABASE_URL!);
      const db = drizzle(sql);

      const [first] = await db
        .insert(affiliate_commissions)
        .values({
          affiliate_id: affiliateId,
          period_year: 2099,
          period_month: 11,
          clients_count: 1,
          total_topups: "100.00",
          total_commissions_gross: "100.00",
          total_supplier_fees: "5.00",
          total_profit_net: "95.00",
          commission_rate: "25.00",
          commission_amount: "23.75",
          status: "preview",
        })
        .returning({ id: affiliate_commissions.id });

      let threw = false;
      try {
        await db.insert(affiliate_commissions).values({
          affiliate_id: affiliateId,
          period_year: 2099,
          period_month: 11,
          clients_count: 2,
          total_topups: "200.00",
          total_commissions_gross: "200.00",
          total_supplier_fees: "10.00",
          total_profit_net: "190.00",
          commission_rate: "25.00",
          commission_amount: "47.50",
          status: "preview",
        });
      } catch {
        threw = true;
      } finally {
        await db.delete(affiliate_commissions).where(eq(affiliate_commissions.id, first.id));
        // Clean up any duplicate that may have been inserted despite expectation
        await db.delete(affiliate_commissions).where(
          and(
            eq(affiliate_commissions.affiliate_id, affiliateId),
            eq(affiliate_commissions.period_year, 2099),
            eq(affiliate_commissions.period_month, 11)
          )
        );
      }

      assert.ok(threw, "should have thrown a unique constraint violation");
    });
  });

  // ── finalize cron ────────────────────────────────────────────────────────────
  describe("GET /api/cron/finalize-commissions", () => {
    it("returns 401 without CRON_SECRET", async () => {
      const res = await fetch(`${BASE}/api/cron/finalize-commissions`);
      assert.equal(res.status, 401);
    });

    it("returns 401 with wrong CRON_SECRET", async () => {
      const res = await fetch(`${BASE}/api/cron/finalize-commissions`, {
        headers: { Authorization: "Bearer wrong-secret" },
      });
      assert.equal(res.status, 401);
    });

    it("returns 200 with valid CRON_SECRET", async () => {
      const secret = process.env.CRON_SECRET;
      if (!secret) {
        // Skip — CRON_SECRET not set in test env
        return;
      }
      const res = await fetch(`${BASE}/api/cron/finalize-commissions`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok("finalized" in data, "should return finalized count");
    });
  });

  // ── affiliate dashboard includes pending_payment ──────────────────────────
  describe("GET /api/affiliate/dashboard — pending_payment field", () => {
    it("includes pending_payment in dashboard response", async () => {
      const { status, data } = await api("GET", "/api/affiliate/dashboard", affiliateCookie);
      assert.equal(status, 200);
      assert.ok("pending_payment" in data, "dashboard should include pending_payment field");
      assert.ok(typeof data.pending_payment === "number", "pending_payment should be a number");
    });
  });

  // ── finalize route returns 410 (retired) ─────────────────────────────────
  describe("PATCH /api/affiliate-commissions/[id]/finalize (retired)", () => {
    it("returns 410 Gone for any call", async () => {
      const { status } = await api(
        "PATCH",
        "/api/affiliate-commissions/00000000-0000-0000-0000-000000000000/finalize",
        adminCookie
      );
      assert.equal(status, 410);
    });
  });
});
