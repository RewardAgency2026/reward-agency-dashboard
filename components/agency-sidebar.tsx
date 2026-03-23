"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { signOut } from "next-auth/react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Clients", href: "/clients", icon: Users },
  { label: "Ad Accounts", href: "/ad-accounts", icon: MonitorPlay },
  { label: "Suppliers", href: "/suppliers", icon: Truck },
  { label: "Top Up Requests", href: "/topup-requests", icon: ArrowUpCircle },
  { label: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "P&L Report", href: "/pnl", icon: BarChart2 },
  { label: "Affiliates", href: "/affiliates", icon: Network },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

interface Props {
  userName: string;
  userRole: string;
}

export function AgencySidebar({ userName, userRole }: Props) {
  const pathname = usePathname();

  return (
    <aside
      className="fixed inset-y-0 left-0 z-50 flex flex-col"
      style={{ width: "var(--sidebar-width)", backgroundColor: "var(--sidebar-bg)" }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-5 py-5"
        style={{ borderBottom: "1px solid var(--sidebar-border)" }}
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-sm font-bold shrink-0"
          style={{ backgroundColor: "var(--sidebar-active)" }}
        >
          R
        </div>
        <span className="text-white font-semibold text-sm leading-tight">
          Reward Agency
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150"
              style={{
                color: isActive ? "#ffffff" : "var(--sidebar-text)",
                backgroundColor: isActive ? "var(--sidebar-active)" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    "var(--sidebar-hover)";
                  (e.currentTarget as HTMLElement).style.color = "#ffffff";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.backgroundColor =
                    "transparent";
                  (e.currentTarget as HTMLElement).style.color =
                    "var(--sidebar-text)";
                }
              }}
            >
              <Icon size={16} className="shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div
        className="px-4 py-4"
        style={{ borderTop: "1px solid var(--sidebar-border)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-semibold shrink-0"
            style={{ backgroundColor: "hsl(222, 47%, 20%)" }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{userName}</p>
            <p className="text-xs capitalize truncate" style={{ color: "var(--sidebar-text)" }}>
              {userRole}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-left text-xs px-2 py-1.5 rounded transition-colors duration-150"
          style={{ color: "var(--sidebar-text)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#ffffff";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--sidebar-text)";
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
