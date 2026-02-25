"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  UserCheck,
  DollarSign,
  BarChart2,
  Star,
  CalendarRange,
  Image,
  ShoppingBag,
  GraduationCap,
  Settings,
  CalendarCheck,
  Inbox,
  Scissors,
  HeartHandshake,
  CalendarPlus,
  Receipt,
  Images,
  Sparkles,
  Gift,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

/* ── Admin navigation ───────────────────────────────────────────────── */

const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: "Daily",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/calendar", label: "Calendar", icon: CalendarRange },
      { href: "/dashboard/bookings", label: "Bookings", icon: CalendarCheck },
      { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/dashboard/clients", label: "Clients", icon: Users },
      { href: "/dashboard/assistants", label: "Assistants", icon: UserCheck },
      { href: "/dashboard/inquiries", label: "Inquiries", icon: Inbox },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/dashboard/financial", label: "Financial", icon: DollarSign },
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart2 },
      { href: "/dashboard/reviews", label: "Reviews", icon: Star },
    ],
  },
  {
    label: "Studio",
    items: [
      { href: "/dashboard/services", label: "Services", icon: Scissors },
      { href: "/dashboard/marketplace", label: "Marketplace", icon: ShoppingBag },
      { href: "/dashboard/training", label: "Training", icon: GraduationCap },
      { href: "/dashboard/media", label: "Media", icon: Image },
    ],
  },
];

const ADMIN_MOBILE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

/* ── Assistant navigation ───────────────────────────────────────────── */

const ASSISTANT_NAV_GROUPS: NavGroup[] = [
  {
    label: "Daily",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/schedule", label: "Schedule", icon: CalendarRange },
      { href: "/dashboard/bookings", label: "Bookings", icon: CalendarCheck },
      { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
    ],
  },
  {
    label: "Work",
    items: [
      { href: "/dashboard/clients", label: "My Clients", icon: Users },
      { href: "/dashboard/services", label: "Services", icon: Scissors },
      { href: "/dashboard/aftercare", label: "Aftercare", icon: HeartHandshake },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/dashboard/earnings", label: "Earnings", icon: DollarSign },
      { href: "/dashboard/training", label: "Training", icon: GraduationCap },
      { href: "/dashboard/reviews", label: "Reviews", icon: Star },
    ],
  },
];

const ASSISTANT_MOBILE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/schedule", label: "Schedule", icon: CalendarRange },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/earnings", label: "Earnings", icon: DollarSign },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

/* ── Client navigation ────────────────────────────────────────────── */

const CLIENT_NAV_GROUPS: NavGroup[] = [
  {
    label: "My Account",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/bookings", label: "My Bookings", icon: CalendarCheck },
      { href: "/dashboard/loyalty", label: "Loyalty & Rewards", icon: Gift },
      { href: "/dashboard/invoices", label: "Invoices", icon: Receipt },
      { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
    ],
  },
  {
    label: "Studio",
    items: [
      { href: "/dashboard/book", label: "Book a Service", icon: CalendarPlus },
      { href: "/dashboard/shop", label: "Shop", icon: ShoppingBag },
      { href: "/dashboard/gallery", label: "Gallery", icon: Images },
      { href: "/dashboard/training", label: "Training", icon: GraduationCap },
      { href: "/dashboard/aftercare", label: "Aftercare", icon: HeartHandshake },
    ],
  },
];

const CLIENT_MOBILE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/book", label: "Book", icon: CalendarPlus },
  { href: "/dashboard/shop", label: "Shop", icon: ShoppingBag },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

/* ── Shared ─────────────────────────────────────────────────────────── */

const SECONDARY_NAV: NavItem[] = [
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));
}

export function DashboardSidebar({ role }: { role: "admin" | "assistant" | "client" }) {
  const isActive = useIsActive();
  const navGroups =
    role === "assistant"
      ? ASSISTANT_NAV_GROUPS
      : role === "client"
        ? CLIENT_NAV_GROUPS
        : ADMIN_NAV_GROUPS;
  const mobileNav =
    role === "assistant"
      ? ASSISTANT_MOBILE_NAV
      : role === "client"
        ? CLIENT_MOBILE_NAV
        : ADMIN_MOBILE_NAV;

  return (
    <>
      {/* ── Desktop sidebar ───────────────────────────────────────── */}
      <aside className="fixed top-0 left-0 bottom-0 w-56 hidden lg:flex flex-col bg-background border-r border-border z-40">
        {/* Brand */}
        <div className="px-4 h-12 flex items-center gap-2.5 border-b border-border shrink-0">
          <div className="w-6 h-6 rounded-md bg-accent/15 flex items-center justify-center shrink-0">
            {role === "client" ? (
              <Sparkles className="w-3.5 h-3.5 text-accent" />
            ) : (
              <span className="text-accent font-bold text-[10px] tracking-tight">TC</span>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground tracking-tight leading-none">
              T Creative
            </p>
            <p className="text-[9px] text-muted mt-0.5 leading-none">
              {role === "assistant" ? "Assistant" : role === "client" ? "Client Portal" : "Admin"}
            </p>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 px-2 py-2 flex flex-col gap-3 overflow-hidden">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-2 mb-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted/50">
                {group.label}
              </p>
              <div className="space-y-px">
                {group.items.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                      isActive(href)
                        ? "bg-foreground/8 text-foreground"
                        : "text-muted hover:bg-foreground/5 hover:text-foreground",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Settings + logout */}
        <div className="px-2 py-2 border-t border-border shrink-0 space-y-px">
          {SECONDARY_NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                isActive(href)
                  ? "bg-foreground/8 text-foreground"
                  : "text-muted hover:bg-foreground/5 hover:text-foreground",
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </Link>
          ))}
          {role === "client" && (
            <form action="/auth/signout" method="POST" className="w-full">
              <button
                type="submit"
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] font-medium text-muted hover:bg-destructive/8 hover:text-destructive transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                Log Out
              </button>
            </form>
          )}
        </div>
      </aside>

      {/* ── Mobile bottom nav ─────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-background/95 backdrop-blur-sm border-t border-border z-40 flex">
        {mobileNav.map(({ href, label, icon: Icon }) => (
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
