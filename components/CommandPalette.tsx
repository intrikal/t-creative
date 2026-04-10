"use client";

/**
 * CommandPalette — Global Cmd+K navigation and search overlay.
 *
 * Provides instant keyboard-driven navigation across all dashboard sections,
 * client search, and common actions. Uses the cmdk primitives from
 * components/ui/command.tsx.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  CalendarDays,
  CalendarCheck,
  Users,
  Briefcase,
  MessageSquare,
  DollarSign,
  BarChart3,
  PartyPopper,
  GraduationCap,
  Store,
  Star,
  Settings,
  UsersRound,
  Heart,
  ShoppingBag,
  ImageIcon,
  Plus,
  Clock,
} from "lucide-react";
import { createPortal } from "react-dom";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const SECTIONS = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Bookings", href: "/dashboard/bookings", icon: CalendarCheck },
  { label: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
  { label: "Clients", href: "/dashboard/clients", icon: Users },
  { label: "Services", href: "/dashboard/services", icon: Briefcase },
  { label: "Messages", href: "/dashboard/messages", icon: MessageSquare },
  { label: "Financial", href: "/dashboard/financial", icon: DollarSign },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Events", href: "/dashboard/events", icon: PartyPopper },
  { label: "Training", href: "/dashboard/training", icon: GraduationCap },
  { label: "Marketplace", href: "/dashboard/marketplace", icon: Store },
  { label: "Reviews", href: "/dashboard/reviews", icon: Star },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
  { label: "Team", href: "/dashboard/team", icon: UsersRound },
  { label: "Loyalty", href: "/dashboard/loyalty", icon: Heart },
  { label: "Shop", href: "/dashboard/shop", icon: ShoppingBag },
  { label: "Gallery", href: "/dashboard/gallery", icon: ImageIcon },
] as const;

const QUICK_ACTIONS = [
  { label: "New Booking", href: "/dashboard/bookings?new=true", icon: Plus },
  { label: "New Client", href: "/dashboard/clients?new=true", icon: Plus },
  { label: "View Schedule", href: "/dashboard/schedule", icon: Clock },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      data-testid="command-palette-overlay"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />

      {/* Palette */}
      <Command
        className="relative w-full max-w-lg rounded-xl border border-border bg-background shadow-2xl"
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        <CommandInput placeholder="Search pages and actions…" autoFocus />
        <CommandList className="max-h-[320px]">
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Pages">
            {SECTIONS.map(({ label, href, icon: Icon }) => (
              <CommandItem key={href} onSelect={() => navigate(href)} value={label}>
                <Icon className="mr-2 size-4 shrink-0" />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Quick Actions">
            {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
              <CommandItem key={href} onSelect={() => navigate(href)} value={label}>
                <Icon className="mr-2 size-4 shrink-0" />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>,
    document.body,
  );
}
