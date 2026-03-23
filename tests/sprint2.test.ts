/**
 * Sprint 2 integration tests
 * Requires the dev server running at http://localhost:3000
 * Run: npm run test:sprint2
 *
 * These tests verify:
 *   1. All agency routes exist (non-404)
 *   2. All client portal routes exist (non-404)
 *   3. All affiliate portal routes exist (non-404)
 *   4. Unauthenticated requests redirect to /login
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

const BASE = "http://localhost:3000";

async function get(path: string): Promise<{ status: number; location: string | null }> {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return {
    status: res.status,
    location: res.headers.get("location"),
  };
}

function isRedirectToLogin(location: string | null): boolean {
  if (!location) return false;
  // location may be absolute (http://localhost:3000/login) or relative (/login)
  return location.includes("/login");
}

// ─── Agency routes ────────────────────────────────────────────────────────────

const AGENCY_ROUTES = [
  "/dashboard",
  "/clients",
  "/ad-accounts",
  "/suppliers",
  "/topup-requests",
  "/transactions",
  "/invoices",
  "/pnl",
  "/affiliates",
  "/settings",
];

describe("Agency routes — unauthenticated", () => {
  for (const route of AGENCY_ROUTES) {
    it(`${route} returns non-404 and redirects to /login`, async () => {
      const { status, location } = await get(route);
      assert.notEqual(status, 404, `${route} returned 404`);
      assert.ok(
        status === 307 || status === 302 || status === 308,
        `${route} expected a redirect, got ${status}`
      );
      assert.ok(isRedirectToLogin(location), `${route} should redirect to /login, got location: ${location}`);
    });
  }
});

// ─── Client portal routes ─────────────────────────────────────────────────────

const CLIENT_ROUTES = [
  "/portal/dashboard",
  "/portal/accounts",
  "/portal/transactions",
  "/portal/topups",
];

describe("Client portal routes — unauthenticated", () => {
  for (const route of CLIENT_ROUTES) {
    it(`${route} returns non-404 and redirects to /login`, async () => {
      const { status, location } = await get(route);
      assert.notEqual(status, 404, `${route} returned 404`);
      assert.ok(
        status === 307 || status === 302 || status === 308,
        `${route} expected a redirect, got ${status}`
      );
      assert.ok(isRedirectToLogin(location), `${route} should redirect to /login, got location: ${location}`);
    });
  }
});

// ─── Affiliate portal routes ──────────────────────────────────────────────────

const AFFILIATE_ROUTES = [
  "/affiliate/dashboard",
  "/affiliate/clients",
  "/affiliate/commissions",
  "/affiliate/link",
  "/affiliate/profile",
];

describe("Affiliate portal routes — unauthenticated", () => {
  for (const route of AFFILIATE_ROUTES) {
    it(`${route} returns non-404 and redirects to /login`, async () => {
      const { status, location } = await get(route);
      assert.notEqual(status, 404, `${route} returned 404`);
      assert.ok(
        status === 307 || status === 302 || status === 308,
        `${route} expected a redirect, got ${status}`
      );
      assert.ok(isRedirectToLogin(location), `${route} should redirect to /login, got location: ${location}`);
    });
  }
});

// ─── /login is public ─────────────────────────────────────────────────────────

describe("Public routes", () => {
  it("/login is accessible without auth (200)", async () => {
    const { status } = await get("/login");
    assert.equal(status, 200, `/login should return 200, got ${status}`);
  });
});
