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
 * DB-wired tabs: Business, Hours, Booking Rules, Policies, Loyalty, Reminders, Notifications.
 * Hardcoded tabs (no DB schema yet): Aftercare, Integrations.
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
  Globe,
  Heart,
  Layers,
  Link2,
  Package,
  Scale,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import type {
  BusinessHourRow,
  LunchBreak,
  TimeOffRow,
  ServiceCategoryRow,
  BookingRulesConfig,
  BusinessProfile,
  CcpaDeletionEntry,
  PolicySettings,
  LoyaltyConfig,
  NotificationPrefs,
  RemindersConfig,
  FinancialConfig,
  InventoryConfig,
  RevenueGoal,
  SiteContent,
} from "@/lib/types/settings.types";
import { cn } from "@/lib/utils";
import type { LegalDocEntry } from "../legal/actions";
import { LegalDocumentsPage } from "../legal/LegalDocumentsPage";
import { AftercareTab } from "./components/AftercareTab";
import { BookingTab } from "./components/BookingTab";
import { BusinessTab } from "./components/BusinessTab";
import { DataDeletionLogTab } from "./components/DataDeletionLogTab";
import { HoursTab } from "./components/HoursTab";
import { IntegrationsTab, type WebhookHealth } from "./components/IntegrationsTab";
import { InventoryTab } from "./components/InventoryTab";
import { LoyaltyTab } from "./components/LoyaltyTab";
import { NotificationsTab } from "./components/NotificationsTab";
import { PoliciesTab } from "./components/PoliciesTab";
import { RemindersTab } from "./components/RemindersTab";
import { ServiceCategoriesTab } from "./components/ServiceCategoriesTab";
import { WebhookEventsTab } from "./components/WebhookEventsTab";
import { WebsiteContentTab } from "./components/WebsiteContentTab";
import type { SquareConnectionStatus } from "./settings-actions";
import type { WebhookEventRow } from "./webhook-actions";

/* ------------------------------------------------------------------ */
/*  Tab config                                                         */
/* ------------------------------------------------------------------ */

const TABS = [
  {
    id: "business",
    label: "Business",
    desc: "Your studio's public profile and contact details",
    icon: Building2,
  },
  { id: "hours", label: "Hours", desc: "Weekly schedule, breaks, and blocked dates", icon: Clock },
  {
    id: "booking",
    label: "Booking Rules",
    desc: "Scheduling constraints and availability",
    icon: CalendarDays,
  },
  {
    id: "policies",
    label: "Policies",
    desc: "Cancellation fees, refunds, and deposit rules",
    icon: FileText,
  },
  { id: "loyalty", label: "Loyalty", desc: "Points, tiers, and referral rewards", icon: Award },
  { id: "aftercare", label: "Aftercare", desc: "Post-service care instructions", icon: Heart },
  { id: "reminders", label: "Reminders", desc: "Automated communication timing", icon: BellRing },
  {
    id: "inventory",
    label: "Inventory",
    desc: "Stock thresholds and gift card settings",
    icon: Package,
  },
  { id: "categories", label: "Categories", desc: "Service category management", icon: Layers },
  {
    id: "integrations",
    label: "Integrations",
    desc: "Third-party connections and sync",
    icon: Link2,
  },
  {
    id: "webhooks",
    label: "Webhooks",
    desc: "Webhook event processing and retries",
    icon: Webhook,
  },
  {
    id: "notifications",
    label: "Notifications",
    desc: "Email and SMS alert preferences",
    icon: Bell,
  },
  { id: "website", label: "Website Content", desc: "Public-facing copy and SEO", icon: Globe },
  { id: "legal", label: "Legal", desc: "Privacy policy and terms of service", icon: Scale },
  {
    id: "data-requests",
    label: "Data Requests",
    desc: "CCPA deletion request log",
    icon: ShieldCheck,
  },
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
  initialFinancial,
  initialRevenueGoals,
  initialBookingRules,
  initialReminders,
  initialSiteContent,
  initialInventory,
  initialCategories,
  squareStatus,
  calendarUrl,
  webhookHealth,
  initialPrivacy,
  initialTerms,
  initialDeletionLog,
  initialWebhookEvents,
}: {
  initialHours: BusinessHourRow[];
  initialTimeOff: TimeOffRow[];
  initialLunchBreak: LunchBreak | null;
  initialBusiness: BusinessProfile;
  initialPolicies: PolicySettings;
  initialLoyalty: LoyaltyConfig;
  initialNotifications: NotificationPrefs;
  initialFinancial: FinancialConfig;
  initialRevenueGoals: RevenueGoal[];
  initialBookingRules: BookingRulesConfig;
  initialReminders: RemindersConfig;
  initialSiteContent: SiteContent;
  initialInventory: InventoryConfig;
  initialCategories: ServiceCategoryRow[];
  squareStatus: SquareConnectionStatus;
  calendarUrl?: string;
  webhookHealth?: WebhookHealth;
  initialPrivacy?: LegalDocEntry | null;
  initialTerms?: LegalDocEntry | null;
  initialDeletionLog?: CcpaDeletionEntry[];
  initialWebhookEvents?: WebhookEventRow[];
}) {
  const [tab, setTab] = useState<Tab>("business");

  const PANEL: Record<Tab, React.ReactNode> = {
    business: (
      <BusinessTab
        initial={initialBusiness}
        initialFinancial={initialFinancial}
        initialRevenueGoals={initialRevenueGoals}
      />
    ),
    hours: (
      <HoursTab
        initialHours={initialHours}
        initialTimeOff={initialTimeOff}
        initialLunchBreak={initialLunchBreak}
      />
    ),
    booking: <BookingTab initial={initialBookingRules} />,
    policies: <PoliciesTab initial={initialPolicies} />,
    loyalty: <LoyaltyTab initial={initialLoyalty} />,
    aftercare: <AftercareTab />,
    reminders: <RemindersTab initial={initialReminders} />,
    inventory: <InventoryTab initial={initialInventory} />,
    categories: <ServiceCategoriesTab initial={initialCategories} />,
    integrations: (
      <IntegrationsTab
        squareConnected={squareStatus.connected}
        squareEnvironment={squareStatus.environment}
        squareLocationId={squareStatus.locationId}
        calendarUrl={calendarUrl}
        webhookHealth={webhookHealth}
      />
    ),
    notifications: <NotificationsTab initial={initialNotifications} />,
    website: <WebsiteContentTab initial={initialSiteContent} />,
    legal: (
      <LegalDocumentsPage
        initialPrivacy={initialPrivacy ?? null}
        initialTerms={initialTerms ?? null}
        embedded
      />
    ),
    webhooks: <WebhookEventsTab initialEvents={initialWebhookEvents ?? []} />,
    "data-requests": <DataDeletionLogTab entries={initialDeletionLog ?? []} />,
  };

  const activeTab = TABS.find((t) => t.id === tab)!;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-muted mt-0.5">Manage your business configuration</p>
      </div>

      {/* Mobile nav — dropdown instead of scrollable tabs */}
      <div className="md:hidden mb-4">
        <select
          value={tab}
          onChange={(e) => setTab(e.target.value as Tab)}
          className="w-full px-3 py-2.5 text-sm font-medium bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30 appearance-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
            backgroundPosition: "right 0.5rem center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "1.5em 1.5em",
          }}
        >
          {TABS.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-8 items-start">
        {/* Side nav — visible on md+ */}
        <nav className="hidden md:flex flex-col gap-0.5 w-52 shrink-0 sticky top-6">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left w-full",
                tab === id
                  ? "bg-foreground text-background"
                  : "text-muted hover:text-foreground hover:bg-foreground/5",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Section header */}
          <div className="mb-5">
            <h2 className="text-base font-semibold text-foreground">{activeTab.label}</h2>
            <p className="text-xs text-muted mt-0.5">{activeTab.desc}</p>
          </div>
          {PANEL[tab]}
        </div>
      </div>
    </div>
  );
}
