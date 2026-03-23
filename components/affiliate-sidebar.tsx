"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, DollarSign, Link2, User, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/affiliate/dashboard", icon: LayoutDashboard },
  { label: "My Clients", href: "/affiliate/clients", icon: Users },
  { label: "Commissions", href: "/affiliate/commissions", icon: DollarSign },
  { label: "My Link", href: "/affiliate/link", icon: Link2 },
  { label: "Profile", href: "/affiliate/profile", icon: User },
] as const;

interface Props {
  userName: string;
}

export function AffiliateSidebar({ userName }: Props) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-[hsl(222,47%,11%)]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-[hsl(222,47%,17%)] px-5 py-[18px]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(236,85%,55%)] text-sm font-bold text-white">
          R
        </div>
        <span className="text-sm font-semibold text-white">Affiliate Portal</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive =
              href === "/affiliate/dashboard"
                ? pathname === "/affiliate/dashboard"
                : pathname.startsWith(href);

            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
                    isActive
                      ? "bg-[hsl(236,85%,55%)] text-white"
                      : "text-[hsl(215,20%,65%)] hover:bg-[hsl(222,47%,16%)] hover:text-white"
                  )}
                >
                  <Icon size={16} className="shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-[hsl(222,47%,17%)] px-4 py-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(222,47%,20%)] text-xs font-semibold text-white">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{userName}</p>
            <p className="truncate text-xs text-[hsl(215,20%,65%)]">Affiliate</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-[hsl(215,20%,65%)] transition-colors hover:text-white"
        >
          <LogOut size={13} className="shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
