"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/portal/dashboard" },
  { label: "My Accounts", href: "/portal/accounts" },
  { label: "Transactions", href: "/portal/transactions" },
  { label: "Top-Ups", href: "/portal/topups" },
] as const;

interface Props {
  userName: string;
}

export function ClientTopNav({ userName }: Props) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between px-6 h-14 max-w-7xl mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-md text-white text-xs font-bold"
            style={{ backgroundColor: "hsl(236, 85%, 55%)" }}
          >
            R
          </div>
          <span className="font-semibold text-sm text-gray-900">Reward Agency</span>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ label, href }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                style={{
                  color: isActive ? "hsl(236, 85%, 55%)" : "hsl(215, 16%, 47%)",
                  backgroundColor: isActive ? "hsl(236, 85%, 97%)" : "transparent",
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User + sign out */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600 font-medium">{userName}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
