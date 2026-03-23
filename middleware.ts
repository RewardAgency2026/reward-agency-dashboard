import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session;
  const { pathname } = nextUrl;

  // Public routes
  if (pathname === "/login") {
    if (isLoggedIn) {
      const userType = session.user.userType;
      const role = session.user.role;
      if (userType === "client") {
        return NextResponse.redirect(new URL("/portal/dashboard", nextUrl));
      } else if (userType === "affiliate") {
        return NextResponse.redirect(new URL("/affiliate/dashboard", nextUrl));
      } else if (["admin", "team", "accountant"].includes(role)) {
        return NextResponse.redirect(new URL("/dashboard", nextUrl));
      }
    }
    return NextResponse.next();
  }

  // Protected agency routes
  if (pathname.startsWith("/dashboard")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    const role = session.user.role;
    if (!["admin", "team", "accountant"].includes(role)) {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    return NextResponse.next();
  }

  // Protected client portal
  if (pathname.startsWith("/portal")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    if (session.user.userType !== "client") {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    return NextResponse.next();
  }

  // Protected affiliate portal
  if (pathname.startsWith("/affiliate")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    if (session.user.userType !== "affiliate") {
      return NextResponse.redirect(new URL("/login", nextUrl));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
