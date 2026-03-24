"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  MonitorPlay,
  Truck,
  ArrowUpCircle,
  ArrowLeftRight,
  FileText,
  BarChart2,
  Network,
  Settings,
  LogOut,
  ClipboardList,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Ad Accounts", href: "/ad-accounts", icon: MonitorPlay },
  { label: "Suppliers", href: "/suppliers", icon: Truck },
  { label: "Top Ups", href: "/topup-requests", icon: ArrowUpCircle, badge: true },
  { label: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "P&L Report", href: "/pnl", icon: BarChart2 },
  { label: "Affiliates", href: "/affiliates", icon: Network },
  { label: "Audit Log", href: "/audit-log", icon: ClipboardList },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

interface Props {
  userName: string;
  userRole: string;
}

const PREFETCH_MAP: Record<string, { key: unknown[]; fn: () => Promise<unknown> }> = {
  "/clients": { key: ["clients"], fn: () => fetch("/api/clients").then((r) => r.json()) },
  "/suppliers": { key: ["suppliers"], fn: () => fetch("/api/suppliers").then((r) => r.json()) },
  "/ad-accounts": { key: ["ad-accounts"], fn: () => fetch("/api/ad-accounts").then((r) => r.json()) },
  "/topup-requests": { key: ["topup-requests"], fn: () => fetch("/api/topup-requests").then((r) => r.json()) },
  "/audit-log": { key: ["audit-logs"], fn: () => fetch("/api/audit-logs").then((r) => r.json()) },
};

export function AgencySidebar({ userName, userRole }: Props) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [topupCount, setTopupCount] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch("/api/topup-requests/count");
        if (res.ok) {
          const { count } = await res.json();
          setTopupCount(count ?? 0);
        }
      } catch {
        // silently ignore
      }
    }
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [pathname]); // re-fetch on every navigation

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-[hsl(222,47%,11%)]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-[hsl(222,47%,17%)] px-5 py-[18px]">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(236,85%,55%)] text-sm font-bold text-white">
          R
        </div>
        <span className="text-sm font-semibold text-white">Reward Agency</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon, ...rest }) => {
            const hasBadge = "badge" in rest && rest.badge;
            const isActive =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);

            return (
              <li key={href}>
                <Link
                  href={href}
                  onMouseEnter={() => {
                    const p = PREFETCH_MAP[href as string];
                    if (p) queryClient.prefetchQuery({ queryKey: p.key, queryFn: p.fn });
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
                    isActive
                      ? "bg-[hsl(236,85%,55%)] text-white"
                      : "text-[hsl(215,20%,65%)] hover:bg-[hsl(222,47%,16%)] hover:text-white"
                  )}
                >
                  <Icon size={16} className="shrink-0" />
                  <span className="flex-1 truncate">{label}</span>
                  {hasBadge && topupCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                      {topupCount}
                    </span>
                  )}
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
            <p className="truncate text-xs capitalize text-[hsl(215,20%,65%)]">{userRole}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-[hsl(215,20%,65%)] transition-colors duration-150 hover:text-white"
        >
          <LogOut size={13} className="shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
