"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Settings,
  UsersRound,
  CalendarCheck,
  LogOut,
  ChevronDown,
  Menu,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { NotificationBell } from "./components/NotificationBell";
import { useSidebar } from "./sidebar-context";

function getProfileMenuItems(role: "admin" | "assistant" | "client") {
  const items = [
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
  ];
  if (role === "admin") {
    items.push({ href: "/dashboard/assistants", label: "Team", icon: UsersRound });
  }
  if (role === "client") {
    items.push({ href: "/dashboard/bookings", label: "My Bookings", icon: CalendarCheck });
  }
  return items;
}

export function DashboardTopBar({
  role,
  userName,
  userAvatarUrl,
}: {
  role: "admin" | "assistant" | "client";
  userName: string;
  userAvatarUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { openDrawer } = useSidebar();

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
    <div className="flex items-center justify-between gap-2 px-4 lg:px-6 py-2.5 shrink-0">
      {/* Left: hamburger on mobile */}
      <button
        onClick={openDrawer}
        aria-label="Open navigation menu"
        className="lg:hidden p-1.5 -ml-1 rounded-lg text-muted hover:bg-foreground/5 hover:text-foreground transition-colors"
        type="button"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Spacer on desktop (hamburger is in sidebar) */}
      <div className="hidden lg:block" />

      {/* Right: notification + profile */}
      <div className="flex items-center gap-2">
        <NotificationBell />

        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border transition-colors",
              open
                ? "border-foreground/20 bg-surface"
                : "border-border hover:border-foreground/15 hover:bg-surface/50",
            )}
            aria-expanded={open}
            aria-label="Profile menu"
            type="button"
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
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-muted transition-transform",
                open && "rotate-180",
              )}
            />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-1 bg-background border border-border rounded-xl shadow-lg py-1 z-50 min-w-[200px]">
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-sm font-medium text-foreground">{userName}</p>
                <p className="text-[11px] text-muted mt-0.5">{roleLabel}</p>
              </div>

              {menuItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  prefetch={false}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-muted hover:bg-foreground/5 hover:text-foreground transition-colors"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              ))}

              <div className="my-1 border-t border-border" />

              <form action="/auth/signout" method="POST" className="w-full">
                <button
                  type="submit"
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-muted hover:bg-destructive/8 hover:text-destructive transition-colors"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  Sign Out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
