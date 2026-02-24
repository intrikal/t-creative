/**
 * Client component — tab shell for `/dashboard/settings`.
 *
 * Renders a responsive side-nav (desktop) / horizontal scrollable tabs (mobile)
 * with 9 sections: Business, Hours, Booking Rules, Policies, Loyalty, Aftercare,
 * Reminders, Integrations, and Notifications.
 *
 * Each tab's content is rendered by a dedicated component in `./components/`.
 * This file contains only the tab navigation scaffold and the `PANELS` mapping.
 *
 * Props flow: `page.tsx` (server) → `SettingsPage` → individual tab components.
 * DB-wired tabs: Business, Hours, Policies, Loyalty, Notifications.
 * Hardcoded tabs (no DB schema yet): Booking Rules, Aftercare, Reminders, Integrations.
 *
 * @module settings/SettingsPage
 * @see {@link ./page.tsx} — server component providing data
 * @see {@link ./components/} — individual tab components
 */
"use client";

import { useState } from "react";
import {
  Award,
  Building2,
  CalendarDays,
  Clock,
  Bell,
  BellRing,
  FileText,
  Heart,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AftercareTab } from "./components/AftercareTab";
import { BookingTab } from "./components/BookingTab";
import { BusinessTab } from "./components/BusinessTab";
import { HoursTab } from "./components/HoursTab";
import { IntegrationsTab } from "./components/IntegrationsTab";
import { LoyaltyTab } from "./components/LoyaltyTab";
import { NotificationsTab } from "./components/NotificationsTab";
import { PoliciesTab } from "./components/PoliciesTab";
import { RemindersTab } from "./components/RemindersTab";
import type { BusinessHourRow, LunchBreak, TimeOffRow } from "./hours-actions";
import type {
  BusinessProfile,
  PolicySettings,
  LoyaltyConfig,
  NotificationPrefs,
} from "./settings-actions";

/* ------------------------------------------------------------------ */
/*  Tab config                                                         */
/* ------------------------------------------------------------------ */

const TABS = [
  { id: "business", label: "Business", icon: Building2 },
  { id: "hours", label: "Hours", icon: Clock },
  { id: "booking", label: "Booking Rules", icon: CalendarDays },
  { id: "policies", label: "Policies", icon: FileText },
  { id: "loyalty", label: "Loyalty", icon: Award },
  { id: "aftercare", label: "Aftercare", icon: Heart },
  { id: "reminders", label: "Reminders", icon: BellRing },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "notifications", label: "Notifications", icon: Bell },
] as const;

type Tab = (typeof TABS)[number]["id"];

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function SettingsPage({
  initialHours,
  initialTimeOff,
  initialLunchBreak,
  initialBusiness,
  initialPolicies,
  initialLoyalty,
  initialNotifications,
}: {
  initialHours: BusinessHourRow[];
  initialTimeOff: TimeOffRow[];
  initialLunchBreak: LunchBreak | null;
  initialBusiness: BusinessProfile;
  initialPolicies: PolicySettings;
  initialLoyalty: LoyaltyConfig;
  initialNotifications: NotificationPrefs;
}) {
  const [tab, setTab] = useState<Tab>("business");

  const PANEL: Record<Tab, React.ReactNode> = {
    business: <BusinessTab initial={initialBusiness} />,
    hours: (
      <HoursTab
        initialHours={initialHours}
        initialTimeOff={initialTimeOff}
        initialLunchBreak={initialLunchBreak}
      />
    ),
    booking: <BookingTab />,
    policies: <PoliciesTab initial={initialPolicies} />,
    loyalty: <LoyaltyTab initial={initialLoyalty} />,
    aftercare: <AftercareTab />,
    reminders: <RemindersTab />,
    integrations: <IntegrationsTab />,
    notifications: <NotificationsTab initial={initialNotifications} />,
  };

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Manage your business configuration</p>
      </div>

      <div className="flex gap-6 items-start">
        {/* Side nav — visible on md+ */}
        <nav className="hidden md:flex flex-col gap-0.5 w-48 shrink-0 sticky top-6">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left w-full",
                tab === id
                  ? "bg-foreground/8 text-foreground"
                  : "text-muted hover:text-foreground hover:bg-foreground/5",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Mobile horizontal tabs */}
        <div className="md:hidden w-full">
          <div className="flex gap-0.5 border-b border-border mb-5 -mx-0">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0",
                  tab === id
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted hover:text-foreground",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">{PANEL[tab]}</div>
      </div>
    </div>
  );
}
