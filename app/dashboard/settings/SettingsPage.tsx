"use client";

/**
 * SettingsPage — Business configuration and preferences.
 *
 * Backed by `settings`, `businessHours`, `bookingRules`, and `policies` tables.
 * All data is hardcoded for now.
 */

import { useState } from "react";
import { Building2, Clock, CalendarDays, FileText, Link2, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & mock data                                                  */
/* ------------------------------------------------------------------ */

const BUSINESS_HOURS = [
  { day: "Monday", open: true, start: "9:00 AM", end: "6:00 PM" },
  { day: "Tuesday", open: true, start: "9:00 AM", end: "6:00 PM" },
  { day: "Wednesday", open: true, start: "10:00 AM", end: "7:00 PM" },
  { day: "Thursday", open: true, start: "10:00 AM", end: "7:00 PM" },
  { day: "Friday", open: true, start: "9:00 AM", end: "6:00 PM" },
  { day: "Saturday", open: true, start: "9:00 AM", end: "4:00 PM" },
  { day: "Sunday", open: false, start: "", end: "" },
];

const BOOKING_RULES = {
  minNoticeHours: 24,
  maxAdvanceDays: 60,
  cancelWindowHours: 48,
  depositRequired: true,
  depositPct: 25,
  allowOnlineBooking: true,
};

const POLICIES = [
  {
    id: 1,
    type: "Cancellation Policy",
    preview:
      "Cancellations must be made at least 48 hours in advance. Late cancellations are subject to a 50% charge of the service fee.",
  },
  {
    id: 2,
    type: "No-Show Policy",
    preview:
      "Clients who no-show without notice will be charged 100% of the service fee and may be required to prepay future appointments.",
  },
  {
    id: 3,
    type: "Aftercare — Lash",
    preview:
      "Avoid water and steam for 24 hours. Do not use oil-based products near your eyes. Brush lashes gently each morning.",
  },
  {
    id: 4,
    type: "Aftercare — Jewelry",
    preview:
      "Permanent jewelry is water-safe but avoid excessive pulling or bending. Clean with mild soap and a soft cloth.",
  },
];

const INTEGRATIONS = [
  { name: "Square", description: "POS & payment processing", connected: true, icon: "💳" },
  { name: "Zoho CRM", description: "Client relationship management", connected: false, icon: "🧩" },
  { name: "Google Calendar", description: "Two-way calendar sync", connected: true, icon: "📅" },
  { name: "Instagram", description: "Booking link in bio", connected: true, icon: "📸" },
];

const NOTIFICATION_PREFS = [
  { label: "New booking confirmation", email: true, sms: true },
  { label: "Booking reminder (24h)", email: true, sms: true },
  { label: "New inquiry received", email: true, sms: false },
  { label: "Cancellation alert", email: true, sms: true },
  { label: "Payment received", email: false, sms: false },
  { label: "Review posted", email: true, sms: false },
];

const TABS = [
  { id: "business", label: "Business", icon: Building2 },
  { id: "hours", label: "Hours", icon: Clock },
  { id: "booking", label: "Booking", icon: CalendarDays },
  { id: "policies", label: "Policies", icon: FileText },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "notifications", label: "Notifications", icon: Bell },
] as const;

type Tab = (typeof TABS)[number]["id"];

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("business");

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Manage your business configuration</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-0.5 overflow-x-auto border-b border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0",
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

      {/* ── Business info ───────────────────────────────────────────── */}
      {tab === "business" && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-5 px-5">
            <CardTitle className="text-sm font-semibold">Business Information</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4 space-y-4">
            {[
              { label: "Business Name", value: "T Creative Studio" },
              { label: "Owner", value: "Trini" },
              { label: "Email", value: "hello@tcreativestudio.com" },
              { label: "Phone", value: "(404) 555-0001" },
              { label: "Location", value: "Atlanta, GA" },
              { label: "Timezone", value: "Eastern Time (ET)" },
              { label: "Currency", value: "USD ($)" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-4">
                <label className="text-xs font-medium text-muted w-36 shrink-0">{label}</label>
                <input
                  type="text"
                  defaultValue={value}
                  className="flex-1 px-3 py-2 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground"
                />
              </div>
            ))}
            <div className="pt-2 flex justify-end">
              <button className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors">
                Save Changes
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Business hours ──────────────────────────────────────────── */}
      {tab === "hours" && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-5 px-5">
            <CardTitle className="text-sm font-semibold">Business Hours</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4 space-y-3">
            {BUSINESS_HOURS.map((row) => (
              <div key={row.day} className="flex items-center gap-4">
                <span className="text-sm text-foreground w-28 shrink-0">{row.day}</span>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-9 h-5 rounded-full relative cursor-pointer transition-colors shrink-0",
                      row.open ? "bg-accent" : "bg-border",
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                        row.open ? "translate-x-4" : "translate-x-0.5",
                      )}
                    />
                  </div>
                  {row.open ? (
                    <>
                      <input
                        type="text"
                        defaultValue={row.start}
                        className="w-24 px-2 py-1 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30"
                      />
                      <span className="text-muted text-xs">to</span>
                      <input
                        type="text"
                        defaultValue={row.end}
                        className="w-24 px-2 py-1 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30"
                      />
                    </>
                  ) : (
                    <span className="text-sm text-muted">Closed</span>
                  )}
                </div>
              </div>
            ))}
            <div className="pt-2 flex justify-end">
              <button className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors">
                Save Hours
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Booking rules ───────────────────────────────────────────── */}
      {tab === "booking" && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-5 px-5">
            <CardTitle className="text-sm font-semibold">Booking Rules</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4 space-y-4">
            {[
              {
                label: "Min notice (hours)",
                key: "minNoticeHours",
                value: BOOKING_RULES.minNoticeHours,
              },
              {
                label: "Max advance (days)",
                key: "maxAdvanceDays",
                value: BOOKING_RULES.maxAdvanceDays,
              },
              {
                label: "Cancellation window (hours)",
                key: "cancelWindowHours",
                value: BOOKING_RULES.cancelWindowHours,
              },
              { label: "Deposit required (%)", key: "depositPct", value: BOOKING_RULES.depositPct },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-4">
                <label className="text-xs font-medium text-muted w-52 shrink-0">{label}</label>
                <input
                  type="number"
                  defaultValue={value}
                  className="w-24 px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30"
                />
              </div>
            ))}
            {[
              { label: "Allow online booking", value: BOOKING_RULES.allowOnlineBooking },
              { label: "Require deposit", value: BOOKING_RULES.depositRequired },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-4">
                <label className="text-xs font-medium text-muted w-52 shrink-0">{label}</label>
                <div
                  className={cn(
                    "w-9 h-5 rounded-full relative cursor-pointer shrink-0",
                    value ? "bg-accent" : "bg-border",
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                      value ? "translate-x-4" : "translate-x-0.5",
                    )}
                  />
                </div>
              </div>
            ))}
            <div className="pt-2 flex justify-end">
              <button className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors">
                Save Rules
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Policies ────────────────────────────────────────────────── */}
      {tab === "policies" && (
        <div className="space-y-3">
          {POLICIES.map((policy) => (
            <Card key={policy.id} className="gap-0">
              <CardHeader className="pb-0 pt-4 px-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{policy.type}</CardTitle>
                  <button className="text-xs text-accent hover:underline">Edit</button>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-4 pt-2">
                <p className="text-sm text-muted leading-relaxed">{policy.preview}</p>
              </CardContent>
            </Card>
          ))}
          <button className="text-sm text-accent hover:underline flex items-center gap-1">
            + Add policy
          </button>
        </div>
      )}

      {/* ── Integrations ────────────────────────────────────────────── */}
      {tab === "integrations" && (
        <div className="space-y-3">
          {INTEGRATIONS.map((integration) => (
            <Card key={integration.name} className="gap-0">
              <CardContent className="px-5 py-4">
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{integration.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{integration.name}</p>
                    <p className="text-xs text-muted mt-0.5">{integration.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full border",
                        integration.connected
                          ? "bg-[#4e6b51]/10 text-[#4e6b51] border-[#4e6b51]/20"
                          : "bg-foreground/5 text-muted border-foreground/10",
                      )}
                    >
                      {integration.connected ? "Connected" : "Not connected"}
                    </span>
                    <button
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                        integration.connected
                          ? "bg-surface border border-border text-muted hover:text-destructive hover:border-destructive/30"
                          : "bg-accent text-accent-foreground hover:bg-accent/90",
                      )}
                    >
                      {integration.connected ? "Disconnect" : "Connect"}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Notifications ───────────────────────────────────────────── */}
      {tab === "notifications" && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-5 px-5">
            <CardTitle className="text-sm font-semibold">Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-3">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-3 items-center">
              <div />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted text-center">
                Email
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted text-center">
                SMS
              </span>
              {NOTIFICATION_PREFS.map((pref) => (
                <>
                  <span key={`${pref.label}-label`} className="text-sm text-foreground">
                    {pref.label}
                  </span>
                  {(["email", "sms"] as const).map((channel) => (
                    <div key={`${pref.label}-${channel}`} className="flex justify-center">
                      <div
                        className={cn(
                          "w-9 h-5 rounded-full relative cursor-pointer shrink-0",
                          pref[channel] ? "bg-accent" : "bg-border",
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                            pref[channel] ? "translate-x-4" : "translate-x-0.5",
                          )}
                        />
                      </div>
                    </div>
                  ))}
                </>
              ))}
            </div>
            <div className="pt-4 flex justify-end">
              <button className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors">
                Save Preferences
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
