"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  LogOut,
  Menu,
  X,
  ChevronUp,
  UsersRound,
} from "lucide-react";
import { TCLogo } from "@/components/TCLogo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
      { href: "/dashboard/events", label: "Events", icon: CalendarDays },
      { href: "/dashboard/training", label: "Training", icon: GraduationCap },
      { href: "/dashboard/media", label: "Media", icon: Image },
    ],
  },
];

const ADMIN_MOBILE_TAB_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
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
      { href: "/dashboard/events", label: "Events", icon: CalendarDays },
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

const ASSISTANT_MOBILE_TAB_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/schedule", label: "Schedule", icon: CalendarRange },
  { href: "/dashboard/messages", label: "Messages", icon: MessageSquare },
  { href: "/dashboard/earnings", label: "Earnings", icon: DollarSign },
];

/* ── Client navigation ────────────────────────────────────────────── */

const CLIENT_NAV_GROUPS: NavGroup[] = [
  {
    label: "My Account",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/bookings", label: "My Bookings", icon: CalendarCheck },
      { href: "/dashboard/events", label: "My Events", icon: PartyPopper },
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

const CLIENT_MOBILE_TAB_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/book", label: "Book", icon: CalendarPlus },
  { href: "/dashboard/shop", label: "Shop", icon: ShoppingBag },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarCheck },
];

/* ── Shared ─────────────────────────────────────────────────────────── */

function getProfileMenuItems(role: "admin" | "assistant" | "client"): NavItem[] {
  const items: NavItem[] = [
    { href: "/dashboard/settings", label: "Profile & Settings", icon: Settings },
  ];
  if (role === "admin") {
    items.push({ href: "/dashboard/assistants", label: "Team", icon: UsersRound });
  }
  if (role === "client") {
    items.push({ href: "/dashboard/bookings", label: "My Bookings", icon: CalendarCheck });
  }
  return items;
}

/* ── Profile popover ──────────────────────────────────────────────── */

function ProfileMenu({
  role,
  isActive,
  userName,
  userAvatarUrl,
  compact = false,
}: {
  role: "admin" | "assistant" | "client";
  isActive: (href: string) => boolean;
  userName: string;
  userAvatarUrl: string | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const menuItems = getProfileMenuItems(role);
  const roleLabel = role === "assistant" ? "Assistant" : role === "client" ? "Client" : "Admin";
  const initials =
    userName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "??";

  return (
    <div ref={ref} className="relative">
      {/* Popover */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-background border border-border rounded-xl shadow-lg py-1 z-50">
          {menuItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors",
                isActive(href)
                  ? "bg-foreground/8 text-foreground"
                  : "text-muted hover:bg-foreground/5 hover:text-foreground",
              )}
            >
              <Icon className={cn("shrink-0", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
              {label}
            </Link>
          ))}
          <div className="my-1 border-t border-border" />
          <form action="/auth/signout" method="POST" className="w-full">
            <button
              type="submit"
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-muted hover:bg-destructive/8 hover:text-destructive transition-colors",
              )}
            >
              <LogOut className={cn("shrink-0", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
              Sign Out
            </button>
          </form>
        </div>
      )}

      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-foreground/5 transition-colors"
      >
        <Avatar size="sm">
          {userAvatarUrl ? (
            <AvatarImage src={userAvatarUrl} alt={userName} />
          ) : (
            <AvatarFallback className="text-[10px] bg-accent/10 text-accent font-semibold">
              {initials}
            </AvatarFallback>
          )}
        </Avatar>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-medium text-foreground truncate leading-none">{userName}</p>
          <p className="text-[9px] text-muted mt-0.5 leading-none truncate">{roleLabel}</p>
        </div>
        <ChevronUp
          className={cn(
            "w-3.5 h-3.5 text-muted shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
    </div>
  );
}

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));
}

/* ── Mobile drawer ──────────────────────────────────────────────────── */

function MobileDrawer({
  open,
  onClose,
  navGroups,
  isActive,
  role,
  userName,
  userAvatarUrl,
}: {
  open: boolean;
  onClose: () => void;
  navGroups: NavGroup[];
  isActive: (href: string) => boolean;
  role: "admin" | "assistant" | "client";
  userName: string;
  userAvatarUrl: string | null;
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

  // Close on route change
  const pathname = usePathname();
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 z-50 lg:hidden transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />
      {/* Drawer */}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 w-64 z-50 lg:hidden bg-background border-r border-border flex flex-col transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Header */}
        <div className="px-4 h-12 flex items-center justify-between border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <TCLogo size={24} className="text-accent shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground tracking-tight leading-none">
                T Creative
              </p>
              <p className="text-[9px] text-muted mt-0.5 leading-none">
                {role === "assistant"
                  ? "Assistant"
                  : role === "client"
                    ? "Client Portal"
                    : "Studio"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-foreground/8 text-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 px-2 py-2 flex flex-col gap-3 overflow-y-auto">
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
                      "flex items-center gap-2.5 px-2 py-2 rounded-md text-[13px] font-medium transition-colors",
                      isActive(href)
                        ? "bg-foreground/8 text-foreground"
                        : "text-muted hover:bg-foreground/5 hover:text-foreground",
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Profile menu */}
        <div className="px-2 py-2 border-t border-border shrink-0">
          <ProfileMenu
            role={role}
            isActive={isActive}
            userName={userName}
            userAvatarUrl={userAvatarUrl}
          />
        </div>
      </aside>
    </>
  );
}

/* ── Main export ────────────────────────────────────────────────────── */

export function DashboardSidebar({
  role,
  userName,
  userAvatarUrl,
}: {
  role: "admin" | "assistant" | "client";
  userName: string;
  userAvatarUrl: string | null;
}) {
  const isActive = useIsActive();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navGroups =
    role === "assistant"
      ? ASSISTANT_NAV_GROUPS
      : role === "client"
        ? CLIENT_NAV_GROUPS
        : ADMIN_NAV_GROUPS;
  const mobileTabNav =
    role === "assistant"
      ? ASSISTANT_MOBILE_TAB_NAV
      : role === "client"
        ? CLIENT_MOBILE_TAB_NAV
        : ADMIN_MOBILE_TAB_NAV;

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <>
      {/* ── Desktop sidebar ───────────────────────────────────────── */}
      <aside className="fixed top-0 left-0 bottom-0 w-56 hidden lg:flex flex-col bg-background border-r border-border z-40">
        {/* Brand */}
        <div className="px-4 h-12 flex items-center gap-2.5 border-b border-border shrink-0">
          <TCLogo size={24} className="text-accent shrink-0" />
          <div>
            <p className="text-xs font-semibold text-foreground tracking-tight leading-none">
              T Creative
            </p>
            <p className="text-[9px] text-muted mt-0.5 leading-none">
              {role === "assistant" ? "Assistant" : role === "client" ? "Client Portal" : "Studio"}
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

        {/* Profile menu */}
        <div className="px-2 py-2 border-t border-border shrink-0">
          <ProfileMenu
            role={role}
            isActive={isActive}
            userName={userName}
            userAvatarUrl={userAvatarUrl}
            compact
          />
        </div>
      </aside>

      {/* ── Mobile bottom nav ─────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-background/95 backdrop-blur-sm border-t border-border z-40 flex">
        {/* Hamburger button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className={cn(
            "flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
            drawerOpen ? "text-accent" : "text-muted hover:text-foreground",
          )}
        >
          <Menu className="w-5 h-5" />
          <span>Menu</span>
        </button>
        {mobileTabNav.map(({ href, label, icon: Icon }) => (
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

      {/* ── Mobile drawer ─────────────────────────────────────────── */}
      <MobileDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        navGroups={navGroups}
        isActive={isActive}
        role={role}
        userName={userName}
        userAvatarUrl={userAvatarUrl}
      />
    </>
  );
}
