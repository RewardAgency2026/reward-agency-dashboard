import { auth } from "@/auth";
import { NextResponse } from "next/server";

// All first-level segments owned by the agency portal
const AGENCY_SEGMENTS = new Set([
  "dashboard",
  "clients",
  "ad-accounts",
  "suppliers",
  "topup-requests",
  "transactions",
  "invoices",
  "pnl",
  "affiliates",
  "settings",
]);

function routeType(pathname: string): "login" | "agency" | "client" | "affiliate" | "public" {
  if (pathname === "/login") return "login";
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return "public";
  if (pathname.startsWith("/portal")) return "client";
  // Must check "/affiliate/" (with trailing slash) before agency check
  // to avoid matching "/affiliates" as an affiliate route
  if (pathname === "/affiliate" || pathname.startsWith("/affiliate/")) return "affiliate";
  const segment = pathname.split("/")[1];
  if (segment && AGENCY_SEGMENTS.has(segment)) return "agency";
  return "public";
}

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session;
  const type = routeType(nextUrl.pathname);

  if (type === "login") {
    if (!isLoggedIn) return NextResponse.next();
    const { userType, role } = session.user;
    if (userType === "client") return NextResponse.redirect(new URL("/portal/dashboard", nextUrl));
    if (userType === "affiliate") return NextResponse.redirect(new URL("/affiliate/dashboard", nextUrl));
    if (["admin", "team", "accountant"].includes(role))
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    return NextResponse.next();
  }

  if (!isLoggedIn && type !== "public") {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (type === "agency") {
    if (!session || !["admin", "team", "accountant"].includes(session.user.role)) {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    return NextResponse.next();
  }

  if (type === "client") {
    if (!session || session.user.userType !== "client") {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    return NextResponse.next();
  }

  if (type === "affiliate") {
    if (!session || session.user.userType !== "affiliate") {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
