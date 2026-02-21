"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  MessageSquare,
  Briefcase,
  TrendingUp,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PRIMARY_NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/inquiries", label: "Inquiries", icon: MessageSquare },
  { href: "/dashboard/staff", label: "Staff", icon: Briefcase },
  { href: "/dashboard/revenue", label: "Revenue", icon: TrendingUp },
] as const;

const SECONDARY_NAV = [{ href: "/dashboard/settings", label: "Settings", icon: Settings }] as const;

/** First 5 items shown in the mobile bottom bar. */
const MOBILE_NAV = [...PRIMARY_NAV.slice(0, 4), ...SECONDARY_NAV] as const;

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));
}

const linkBase =
  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors";
const linkActive = "bg-foreground/8 text-foreground";
const linkInactive = "text-muted hover:bg-foreground/5 hover:text-foreground";

export function DashboardSidebar() {
  const isActive = useIsActive();

  return (
    <>
      {/* ── Desktop sidebar ───────────────────────────────────────── */}
      <aside className="fixed top-16 left-0 bottom-0 w-60 hidden lg:flex flex-col bg-background border-r border-border z-40 overflow-y-auto">
        {/* Business label */}
        <div className="px-5 py-4 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Admin Dashboard
          </p>
        </div>

        {/* Primary nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {PRIMARY_NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(linkBase, isActive(href) ? linkActive : linkInactive)}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Secondary nav */}
        <div className="py-3 px-2 border-t border-border space-y-0.5">
          {SECONDARY_NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(linkBase, isActive(href) ? linkActive : linkInactive)}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}
        </div>
      </aside>

      {/* ── Mobile bottom nav ─────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-background/95 backdrop-blur-sm border-t border-border z-40 flex safe-b">
        {MOBILE_NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
              isActive(href) ? "text-accent" : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
