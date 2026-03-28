"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Mails,
  Users,
  MessageSquare,
  UserCheck,
  DollarSign,
  BarChart2,
  Star,
  CalendarRange,
  CalendarDays,
  PartyPopper,
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
  Gift,
  Bell,
  Camera,
  Menu,
  X,
  ShieldCheck,
  Rocket,
} from "lucide-react";
import { TCLogo } from "@/components/TCLogo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./components/NotificationBell";
import { useSidebar } from "./sidebar-context";

/* ── Types ─────────────────────────────────────────────────────────── */

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
      { href: "/dashboard/get-started", label: "Get Started", icon: Rocket },
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/calendar", label: "Calendar", icon: CalendarRange },
      { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/dashboard/clients", label: "Clients", icon: Users },
      { href: "/dashboard/team", label: "Team", icon: UserCheck },
      { href: "/dashboard/inquiries", label: "Inquiries", icon: Inbox },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/dashboard/financial", label: "Financial", icon: DollarSign },
      { href: "/dashboard/analytics", label: "Insights", icon: BarChart2 },
      { href: "/dashboard/reviews", label: "Reviews", icon: Star },
      { href: "/dashboard/sequences", label: "Sequences", icon: Mails },
    ],
  },
  {
    label: "Studio",
    items: [
      { href: "/dashboard/catalog", label: "Catalog", icon: ShoppingBag },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

/* ── Assistant navigation ───────────────────────────────────────────── */

const ASSISTANT_NAV_GROUPS: NavGroup[] = [
  {
    label: "Daily",
    items: [
      { href: "/dashboard/get-started", label: "Get Started", icon: Rocket },
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/schedule", label: "Schedule", icon: CalendarRange },
      { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Work",
    items: [
      { href: "/dashboard/clients", label: "My Clients", icon: Users },
      { href: "/dashboard/services", label: "Services", icon: Scissors },
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

/* ── Client navigation ────────────────────────────────────────────── */

const CLIENT_NAV_GROUPS: NavGroup[] = [
  {
    label: "My Account",
    items: [
      { href: "/dashboard/get-started", label: "Get Started", icon: Rocket },
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/bookings", label: "My Bookings", icon: CalendarCheck },
      { href: "/dashboard/loyalty", label: "Loyalty & Rewards", icon: Gift },
      { href: "/dashboard/invoices", label: "Invoices", icon: Receipt },
      { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Studio",
    items: [
      { href: "/dashboard/book", label: "Book a Service", icon: CalendarPlus },
      { href: "/dashboard/shop", label: "Shop", icon: ShoppingBag },
      { href: "/dashboard/my-photos", label: "Photos", icon: Camera },
      { href: "/dashboard/training", label: "Training", icon: GraduationCap },
      { href: "/dashboard/aftercare", label: "Aftercare", icon: HeartHandshake },
    ],
  },
];

/* ── Shared ─────────────────────────────────────────────────────────── */

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));
}

/* ── Mobile full-screen menu ─────────────────────────────────────────── */

function MobileMenu({
  open,
  onClose,
  navGroups,
  isActive,
  setupProgress,
}: {
  open: boolean;
  onClose: () => void;
  navGroups: NavGroup[];
  isActive: (href: string) => boolean;
  setupProgress?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const pathname = usePathname();
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  const allItems = navGroups.flatMap((g) => g.items);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
      className={cn(
        "fixed inset-0 z-50 lg:hidden bg-background flex flex-col transition-opacity duration-200",
        open ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
    >
      {/* Top bar — hamburger (close) */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0">
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="p-2.5 -ml-1 rounded-lg text-muted hover:bg-foreground/5 hover:text-foreground transition-colors"
          type="button"
        >
          <X className="w-5 h-5" />
        </button>
        <NotificationBell />
      </div>

      {/* Nav items — flat list, large tap targets */}
      <nav aria-label="Dashboard" className="flex-1 px-4 py-2 overflow-y-auto">
        <div className="space-y-0.5">
          {allItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              prefetch={false}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg text-[15px] font-medium transition-colors",
                isActive(href)
                  ? "bg-foreground/8 text-foreground"
                  : "text-muted hover:bg-foreground/5 hover:text-foreground",
              )}
            >
              {setupProgress && label === "Get Started" ? (
                <span className="text-[12px] font-semibold text-muted/60 tabular-nums shrink-0">
                  {setupProgress}
                </span>
              ) : (
                <Icon className="w-5 h-5 shrink-0" />
              )}
              {label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Footer — brand */}
      <div className="shrink-0 flex items-center justify-center gap-2 py-4">
        <TCLogo size={18} className="text-accent shrink-0" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted/50">
          T Creative Studio
        </span>
      </div>
    </div>
  );
}

/* ── Main export ────────────────────────────────────────────────────── */

export function DashboardSidebar({
  role,
  setupProgress,
}: {
  role: "admin" | "assistant" | "client";
  setupProgress?: string;
}) {
  const isActive = useIsActive();
  const { expanded, toggle, drawerOpen, closeDrawer } = useSidebar();

  const navGroups =
    role === "assistant"
      ? ASSISTANT_NAV_GROUPS
      : role === "client"
        ? CLIENT_NAV_GROUPS
        : ADMIN_NAV_GROUPS;

  // Close on Escape
  useEffect(() => {
    if (!expanded) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") toggle();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [expanded, toggle]);

  // Flatten all nav items for the icon rail
  const allItems = navGroups.flatMap((g) => g.items);

  // Split nav: settings goes to the bottom, everything else is main nav
  const mainItems: NavItem[] = [];
  const bottomItems: NavItem[] = [];
  for (const item of allItems) {
    if (item.href === "/dashboard/settings") {
      bottomItems.push(item);
    } else {
      mainItems.push(item);
    }
  }

  return (
    <>
      {/* ── Desktop sidebar (push) ─────────────────────────────── */}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 hidden lg:flex flex-col bg-background border-r border-border z-40 transition-[width] duration-300 ease-in-out overflow-hidden",
          expanded ? "w-56" : "w-14",
        )}
      >
        <TooltipProvider delayDuration={0}>
          {/* Toggle — hamburger */}
          <div className={cn("shrink-0 px-2 pt-3 pb-1", expanded ? "px-3" : "px-2")}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggle}
                  className={cn(
                    "flex items-center justify-center rounded-lg text-muted hover:bg-foreground/5 hover:text-foreground transition-colors",
                    expanded ? "w-10 h-10" : "w-10 h-10 mx-auto",
                  )}
                  aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
                  type="button"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              {!expanded && (
                <TooltipContent side="right" sideOffset={8}>
                  Expand sidebar
                </TooltipContent>
              )}
            </Tooltip>
          </div>

          {/* Main nav — flat list */}
          <nav
            aria-label="Dashboard"
            className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden px-2 py-1"
          >
            <div className={cn("flex flex-col", expanded ? "gap-0.5" : "gap-1")}>
              {mainItems.map(({ href, label, icon: Icon }) => {
                const isGetStarted = setupProgress && label === "Get Started";
                return expanded ? (
                  <Link
                    key={href}
                    href={href}
                    prefetch={false}
                    aria-current={isActive(href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] font-medium transition-colors whitespace-nowrap",
                      isActive(href)
                        ? "bg-foreground/8 text-foreground"
                        : "text-muted hover:bg-foreground/5 hover:text-foreground",
                    )}
                  >
                    {isGetStarted ? (
                      <span className="text-[13px] font-semibold text-muted/60 tabular-nums shrink-0">
                        {setupProgress}
                      </span>
                    ) : (
                      <Icon className="w-5 h-5 shrink-0" />
                    )}
                    <span className="truncate">{label}</span>
                  </Link>
                ) : (
                  <Tooltip key={href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={href}
                        prefetch={false}
                        aria-current={isActive(href) ? "page" : undefined}
                        className={cn(
                          "flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-colors",
                          isActive(href)
                            ? "bg-foreground/8 text-foreground"
                            : "text-muted hover:bg-foreground/5 hover:text-foreground",
                        )}
                      >
                        {isGetStarted ? (
                          <span className="text-[11px] font-bold tabular-nums leading-none">
                            {setupProgress}
                          </span>
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      {label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </nav>

          {/* Bottom items (Settings) + brand */}
          <div
            className={cn(
              "shrink-0 flex flex-col border-t border-border px-2 py-2",
              expanded ? "gap-0.5" : "gap-1",
            )}
          >
            {bottomItems.map(({ href, label, icon: Icon }) =>
              expanded ? (
                <Link
                  key={href}
                  href={href}
                  prefetch={false}
                  aria-current={isActive(href) ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] font-medium transition-colors whitespace-nowrap",
                    isActive(href)
                      ? "bg-foreground/8 text-foreground"
                      : "text-muted hover:bg-foreground/5 hover:text-foreground",
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              ) : (
                <Tooltip key={href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={href}
                      prefetch={false}
                      aria-current={isActive(href) ? "page" : undefined}
                      className={cn(
                        "flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-colors",
                        isActive(href)
                          ? "bg-foreground/8 text-foreground"
                          : "text-muted hover:bg-foreground/5 hover:text-foreground",
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {label}
                  </TooltipContent>
                </Tooltip>
              ),
            )}

            {/* Brand */}
            <div
              className={cn("flex items-center py-2", expanded ? "px-3 gap-2" : "justify-center")}
            >
              <TCLogo size={18} className="text-accent shrink-0" />
              {expanded && (
                <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted/50 whitespace-nowrap">
                  T Creative Studio
                </span>
              )}
            </div>
          </div>
        </TooltipProvider>
      </aside>

      {/* ── Mobile full-screen menu ──────────────────────────────── */}
      <MobileMenu
        open={drawerOpen}
        onClose={closeDrawer}
        navGroups={navGroups}
        isActive={isActive}
        setupProgress={setupProgress}
      />
    </>
  );
}
