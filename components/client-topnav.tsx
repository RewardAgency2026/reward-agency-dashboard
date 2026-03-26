"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/portal/dashboard" },
  { label: "My Accounts", href: "/portal/accounts" },
  { label: "Transactions", href: "/portal/transactions" },
  { label: "Top-Ups", href: "/portal/topups" },
] as const;

interface Props {
  userName: string;
  clientCode: string;
}

export function ClientTopNav({ userName, clientCode }: Props) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[hsl(236,85%,55%)] text-xs font-bold text-white">
            R
          </div>
          <span className="text-sm font-semibold text-gray-900">Reward Agency</span>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ label, href }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[hsl(236,85%,95%)] text-[hsl(236,85%,55%)]"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User + sign out */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">{userName}</span>
            {clientCode && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-500">
                {clientCode}
              </span>
            )}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-gray-700"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
