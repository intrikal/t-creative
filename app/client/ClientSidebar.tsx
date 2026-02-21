"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  MessageSquare,
  HeartHandshake,
  Settings,
  Sparkles,
  CalendarPlus,
  ShoppingBag,
  GraduationCap,
  Receipt,
  Images,
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

const NAV_GROUPS: NavGroup[] = [
  {
    label: "My Account",
    items: [
      { href: "/client", label: "Overview", icon: LayoutDashboard },
      { href: "/client/bookings", label: "My Bookings", icon: CalendarCheck },
      { href: "/client/invoices", label: "Invoices", icon: Receipt },
      { href: "/client/messages", label: "Messages", icon: MessageSquare },
    ],
  },
  {
    label: "Studio",
    items: [
      { href: "/client/book", label: "Book a Service", icon: CalendarPlus },
      { href: "/client/shop", label: "Shop", icon: ShoppingBag },
      { href: "/client/gallery", label: "Gallery", icon: Images },
      { href: "/client/training", label: "Training", icon: GraduationCap },
      { href: "/client/aftercare", label: "Aftercare", icon: HeartHandshake },
    ],
  },
];

const MOBILE_NAV: NavItem[] = [
  { href: "/client", label: "Home", icon: LayoutDashboard },
  { href: "/client/book", label: "Book", icon: CalendarPlus },
  { href: "/client/shop", label: "Shop", icon: ShoppingBag },
  { href: "/client/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/client/settings", label: "Settings", icon: Settings },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/client" ? pathname === href : pathname.startsWith(href));
}

export function ClientSidebar() {
  const isActive = useIsActive();

  return (
    <>
      {/* ── Desktop sidebar ───────────────────────────────────────── */}
      <aside className="fixed top-0 left-0 bottom-0 w-56 hidden lg:flex flex-col bg-background border-r border-border z-40">
        {/* Brand */}
        <div className="px-4 h-12 flex items-center gap-2.5 border-b border-border shrink-0">
          <div className="w-6 h-6 rounded-md bg-accent/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground tracking-tight leading-none">
              T Creative
            </p>
            <p className="text-[9px] text-muted mt-0.5 leading-none">Client Portal</p>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 px-2 py-2 flex flex-col gap-3 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
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

        {/* Footer — settings + logout */}
        <div className="px-2 py-2 border-t border-border shrink-0 space-y-px">
          <Link
            href="/client/settings"
            className={cn(
              "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] font-medium transition-colors",
              isActive("/client/settings")
                ? "bg-foreground/8 text-foreground"
                : "text-muted hover:bg-foreground/5 hover:text-foreground",
            )}
          >
            <Settings className="w-3.5 h-3.5 shrink-0" />
            Settings
          </Link>
          <button
            onClick={() => {}}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] font-medium text-muted hover:bg-destructive/8 hover:text-destructive transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            Log Out
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom nav ─────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-background/95 backdrop-blur-sm border-t border-border z-40 flex">
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
