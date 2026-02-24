"use client";

import { useState } from "react";
import {
  Building2,
  CalendarDays,
  Clock,
  Bell,
  BellRing,
  Check,
  FileText,
  Heart,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BusinessHourRow, LunchBreak, TimeOffRow } from "./hours-actions";
import { addTimeOff, deleteTimeOff, saveLunchBreak, saveBusinessHours } from "./hours-actions";

/* ------------------------------------------------------------------ */
/*  Types & mock data                                                  */
/* ------------------------------------------------------------------ */

const BUSINESS_FIELDS = [
  { label: "Business Name", value: "T Creative Studio" },
  { label: "Owner", value: "Trini" },
  { label: "Email", value: "hello@tcreativestudio.com" },
  { label: "Phone", value: "(408) 555-0001" },
  { label: "Location", value: "San Jose, CA" },
  { label: "Timezone", value: "Eastern Time (ET)" },
  { label: "Currency", value: "USD ($)" },
  { label: "Booking Link", value: "tcreative.studio/book" },
];

/** Maps ISO day-of-week (1–7) to a display name. Index 0 is unused. */
const DAY_NAMES = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/**
 * Formats a "YYYY-MM-DD" date string to a readable label like "Feb 14, 2026".
 * Uses the local Date constructor (not UTC) to match the user's timezone.
 */
function formatBlockedDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const INITIAL_BOOKING = {
  minNoticeHours: 24,
  maxAdvanceDays: 60,
  cancelWindowHours: 48,
  depositRequired: true,
  depositPct: 25,
  allowOnlineBooking: true,
  bufferMinutes: 15,
  maxDailyBookings: 8,
};

const POLICIES = [
  {
    id: 1,
    type: "Cancellation Policy",
    body: "Cancellations must be made at least 48 hours in advance. Late cancellations are subject to a 50% charge of the service fee.",
  },
  {
    id: 2,
    type: "No-Show Policy",
    body: "Clients who no-show without notice will be charged 100% of the service fee and may be required to prepay future appointments.",
  },
  {
    id: 3,
    type: "Aftercare — Lash",
    body: "Avoid water and steam for 24 hours. Do not use oil-based products near your eyes. Brush lashes gently each morning.",
  },
  {
    id: 4,
    type: "Aftercare — Jewelry",
    body: "Permanent jewelry is water-safe but avoid excessive pulling or bending. Clean with mild soap and a soft cloth.",
  },
];

const INTEGRATIONS = [
  // Payments & POS
  {
    name: "Square",
    description: "POS, payments, text reminders & appointments",
    connected: true,
    icon: "💳",
    category: "Payments",
  },
  // CRM & Business
  {
    name: "Zoho",
    description: "Client CRM & email marketing",
    connected: true,
    icon: "🧩",
    category: "Business",
  },
  {
    name: "QuickBooks",
    description: "Accounting, expenses & tax prep",
    connected: false,
    icon: "📊",
    category: "Business",
  },
  // Calendar & Booking
  {
    name: "Google Calendar",
    description: "Two-way sync with your studio calendar",
    connected: true,
    icon: "📅",
    category: "Calendar",
  },
  // Marketing & Social
  {
    name: "Instagram",
    description: "Booking link in bio + story promotions",
    connected: true,
    icon: "📸",
    category: "Marketing",
  },
  {
    name: "TikTok",
    description: "Reach new clients through beauty content",
    connected: false,
    icon: "🎵",
    category: "Marketing",
  },
  {
    name: "Google Business",
    description: "Reviews, Google Maps & local search visibility",
    connected: false,
    icon: "🗺️",
    category: "Marketing",
  },
];

const NOTIFICATION_PREFS = [
  { label: "New booking confirmation", email: true, sms: true },
  { label: "Booking reminder (24h)", email: true, sms: true },
  { label: "New inquiry received", email: true, sms: false },
  { label: "Cancellation alert", email: true, sms: true },
  { label: "Payment received", email: false, sms: false },
  { label: "Review posted", email: true, sms: false },
  { label: "No-show flagged", email: true, sms: true },
];

const TABS = [
  { id: "business", label: "Business", icon: Building2 },
  { id: "hours", label: "Hours", icon: Clock },
  { id: "booking", label: "Booking Rules", icon: CalendarDays },
  { id: "policies", label: "Policies", icon: FileText },
  { id: "aftercare", label: "Aftercare", icon: Heart },
  { id: "reminders", label: "Reminders", icon: BellRing },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "notifications", label: "Notifications", icon: Bell },
] as const;

type Tab = (typeof TABS)[number]["id"];

/* ------------------------------------------------------------------ */
/*  Toggle component                                                   */
/* ------------------------------------------------------------------ */

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={cn(
        "relative w-10 h-[22px] rounded-full overflow-hidden transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        on ? "bg-accent" : "bg-foreground/20",
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200",
          on ? "translate-x-[22px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Field row                                                          */
/* ------------------------------------------------------------------ */

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <label className="text-xs font-medium text-muted sm:w-44 shrink-0">{label}</label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

function TextInput({
  defaultValue,
  type = "text",
  className,
}: {
  defaultValue: string | number;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      defaultValue={defaultValue}
      className={cn(
        "w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30 transition",
        className,
      )}
    />
  );
}

function SaveButton({ label = "Save Changes" }: { label?: string }) {
  return (
    <button className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-1.5">
      <Check className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab panels                                                         */
/* ------------------------------------------------------------------ */

function BusinessTab() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Business Information</h2>
        <p className="text-xs text-muted mt-0.5">
          Your studio&apos;s public profile and contact details
        </p>
      </div>
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
          {BUSINESS_FIELDS.map(({ label, value }) => (
            <FieldRow key={label} label={label}>
              <TextInput defaultValue={value} />
            </FieldRow>
          ))}
          <FieldRow label="Bio / About">
            <textarea
              rows={3}
              defaultValue="T Creative Studio is a San Francisco Bay Area based beauty studio specializing in lash extensions, permanent jewelry, crochet braids, and business consulting for beauty entrepreneurs."
              className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30 resize-none transition"
            />
          </FieldRow>
          <div className="flex justify-end pt-2 border-t border-border/50">
            <SaveButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * HoursTab — Working hours settings: weekly schedule, lunch break, blocked dates.
 *
 * All three sections save independently so Trini can update one without
 * touching the others. State is initialised from server-fetched props
 * and patched optimistically after each successful save.
 *
 * ## Time format
 * Internally (state + DB) uses "HH:MM" 24-hour strings. The browser's
 * native `<input type="time">` renders this in the user's locale (12-hour
 * on macOS by default) while the value stays in HH:MM — no manual
 * conversion needed.
 */
function HoursTab({
  initialHours,
  initialTimeOff,
  initialLunchBreak,
}: {
  initialHours: BusinessHourRow[];
  initialTimeOff: TimeOffRow[];
  initialLunchBreak: LunchBreak | null;
}) {
  /* ---- Weekly schedule ---- */
  const [days, setDays] = useState(() =>
    initialHours.map((h) => ({
      id: h.id,
      dayOfWeek: h.dayOfWeek,
      isOpen: h.isOpen,
      opensAt: h.opensAt ?? "09:00",
      closesAt: h.closesAt ?? "18:00",
    })),
  );
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursSaved, setHoursSaved] = useState(false);

  /* ---- Lunch break ---- */
  const [lunch, setLunch] = useState<LunchBreak>(
    initialLunchBreak ?? { enabled: false, start: "12:00", end: "13:00" },
  );
  const [lunchSaving, setLunchSaving] = useState(false);
  const [lunchSaved, setLunchSaved] = useState(false);

  /* ---- Blocked dates ---- */
  const [blocked, setBlocked] = useState(initialTimeOff);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState<"day_off" | "vacation">("day_off");
  const [addStart, setAddStart] = useState("");
  const [addEnd, setAddEnd] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [adding, setAdding] = useState(false);

  /* ---- Handlers ---- */

  async function handleSaveHours() {
    setHoursSaving(true);
    try {
      await saveBusinessHours(
        days.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          isOpen: d.isOpen,
          opensAt: d.isOpen ? d.opensAt : null,
          closesAt: d.isOpen ? d.closesAt : null,
        })),
      );
      setHoursSaved(true);
      setTimeout(() => setHoursSaved(false), 2000);
    } finally {
      setHoursSaving(false);
    }
  }

  async function handleSaveLunch() {
    setLunchSaving(true);
    try {
      await saveLunchBreak(lunch);
      setLunchSaved(true);
      setTimeout(() => setLunchSaved(false), 2000);
    } finally {
      setLunchSaving(false);
    }
  }

  async function handleAddBlocked() {
    if (!addStart) return;
    setAdding(true);
    try {
      const row = await addTimeOff({
        type: addType,
        startDate: addStart,
        endDate: addType === "day_off" ? addStart : addEnd || addStart,
        label: addLabel || undefined,
      });
      setBlocked((prev) => [...prev, row]);
      setShowAddForm(false);
      setAddStart("");
      setAddEnd("");
      setAddLabel("");
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteBlocked(id: number) {
    await deleteTimeOff(id);
    setBlocked((prev) => prev.filter((b) => b.id !== id));
  }

  const timeInputClass =
    "px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30 transition";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Working Hours</h2>
        <p className="text-xs text-muted mt-0.5">
          Manage your weekly schedule, lunch break, and blocked dates
        </p>
      </div>

      {/* ── Weekly Schedule ── */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5 px-5">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Weekly Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 space-y-1">
          {days.map((row, idx) => (
            <div
              key={row.dayOfWeek}
              className="flex items-center gap-4 py-3 rounded-xl px-3 hover:bg-surface/60 transition-colors"
            >
              <span
                className={cn(
                  "text-sm w-28 shrink-0 font-medium",
                  row.isOpen ? "text-foreground" : "text-muted/60",
                )}
              >
                {DAY_NAMES[row.dayOfWeek]}
              </span>
              <div className="flex-1 flex items-center gap-2">
                {row.isOpen ? (
                  <>
                    <input
                      type="time"
                      value={row.opensAt}
                      onChange={(e) =>
                        setDays((prev) =>
                          prev.map((d, i) => (i === idx ? { ...d, opensAt: e.target.value } : d)),
                        )
                      }
                      className={cn(timeInputClass, "w-28")}
                    />
                    <span className="text-muted text-xs shrink-0">to</span>
                    <input
                      type="time"
                      value={row.closesAt}
                      onChange={(e) =>
                        setDays((prev) =>
                          prev.map((d, i) => (i === idx ? { ...d, closesAt: e.target.value } : d)),
                        )
                      }
                      className={cn(timeInputClass, "w-28")}
                    />
                  </>
                ) : (
                  <span className="text-sm text-muted/40 italic">Closed</span>
                )}
              </div>
              <Toggle
                on={row.isOpen}
                onChange={() =>
                  setDays((prev) =>
                    prev.map((d, i) => (i === idx ? { ...d, isOpen: !d.isOpen } : d)),
                  )
                }
              />
            </div>
          ))}
          <div className="flex justify-end pt-3 border-t border-border/50 mt-2">
            <button
              onClick={handleSaveHours}
              disabled={hoursSaving}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-1.5 disabled:opacity-60"
            >
              <Check className="w-3.5 h-3.5" />
              {hoursSaved ? "Saved!" : hoursSaving ? "Saving…" : "Save Hours"}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ── Lunch Break ── */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5 px-5">
          <CardTitle className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Lunch Break
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 space-y-4">
          <ToggleRow
            label="Block lunch break"
            hint="Prevent new bookings during your lunch window"
            on={lunch.enabled}
            onChange={(v) => setLunch((prev) => ({ ...prev, enabled: v }))}
          />
          {lunch.enabled && (
            <div className="flex items-center gap-3 pl-1">
              <input
                type="time"
                value={lunch.start}
                onChange={(e) => setLunch((prev) => ({ ...prev, start: e.target.value }))}
                className={cn(timeInputClass, "w-28")}
              />
              <span className="text-muted text-xs shrink-0">to</span>
              <input
                type="time"
                value={lunch.end}
                onChange={(e) => setLunch((prev) => ({ ...prev, end: e.target.value }))}
                className={cn(timeInputClass, "w-28")}
              />
            </div>
          )}
          <div className="flex justify-end pt-2 border-t border-border/50">
            <button
              onClick={handleSaveLunch}
              disabled={lunchSaving}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-1.5 disabled:opacity-60"
            >
              <Check className="w-3.5 h-3.5" />
              {lunchSaved ? "Saved!" : lunchSaving ? "Saving…" : "Save Lunch Break"}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ── Blocked Dates ── */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Blocked Dates
            </CardTitle>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-foreground/5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 space-y-3">
          {/* Inline add form — expands when "Add" is clicked */}
          {showAddForm && (
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap gap-3">
                {/* Type */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-muted uppercase tracking-wide">
                    Type
                  </label>
                  <select
                    value={addType}
                    onChange={(e) => setAddType(e.target.value as "day_off" | "vacation")}
                    className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none"
                  >
                    <option value="day_off">Day Off</option>
                    <option value="vacation">Vacation</option>
                  </select>
                </div>

                {/* Start date */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-muted uppercase tracking-wide">
                    {addType === "day_off" ? "Date" : "Start Date"}
                  </label>
                  <input
                    type="date"
                    value={addStart}
                    onChange={(e) => setAddStart(e.target.value)}
                    className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none"
                  />
                </div>

                {/* End date — only for vacations */}
                {addType === "vacation" && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-medium text-muted uppercase tracking-wide">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={addEnd}
                      min={addStart}
                      onChange={(e) => setAddEnd(e.target.value)}
                      className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none"
                    />
                  </div>
                )}

                {/* Label */}
                <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
                  <label className="text-[10px] font-medium text-muted uppercase tracking-wide">
                    Label (optional)
                  </label>
                  <input
                    type="text"
                    value={addLabel}
                    onChange={(e) => setAddLabel(e.target.value)}
                    placeholder="e.g. Hawaii trip"
                    className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAddBlocked}
                  disabled={!addStart || adding}
                  className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-1 disabled:opacity-60"
                >
                  <Check className="w-3 h-3" />
                  {adding ? "Adding…" : "Add"}
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs font-medium text-muted rounded-lg hover:bg-foreground/5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {blocked.length === 0 && !showAddForm && (
            <p className="text-sm text-muted/60 italic text-center py-4">
              No blocked dates — your schedule is fully open.
            </p>
          )}

          {/* Blocked date list */}
          {blocked.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl bg-surface/60"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0",
                      entry.type === "day_off"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-blue-50 text-blue-600",
                    )}
                  >
                    {entry.type === "day_off" ? "Day Off" : "Vacation"}
                  </span>
                  {entry.label && (
                    <span className="text-sm font-medium text-foreground truncate">
                      {entry.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {entry.startDate === entry.endDate
                    ? formatBlockedDate(entry.startDate)
                    : `${formatBlockedDate(entry.startDate)} – ${formatBlockedDate(entry.endDate)}`}
                </p>
              </div>
              <button
                onClick={() => handleDeleteBlocked(entry.id)}
                className="text-muted hover:text-destructive transition-colors shrink-0 p-1.5 rounded-lg hover:bg-destructive/10"
                title="Remove blocked date"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function BookingTab() {
  const [rules, setRules] = useState(INITIAL_BOOKING);

  function toggleRule(key: "depositRequired" | "allowOnlineBooking") {
    setRules((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Booking Rules</h2>
        <p className="text-xs text-muted mt-0.5">Control how and when clients can book with you</p>
      </div>

      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5 px-5">
          <CardTitle className="text-sm font-semibold text-muted uppercase tracking-wide text-[10px]">
            Scheduling
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 space-y-4">
          <FieldRow label="Min notice (hours)">
            <TextInput
              defaultValue={rules.minNoticeHours}
              type="number"
              className="max-w-[120px]"
            />
          </FieldRow>
          <FieldRow label="Max advance (days)">
            <TextInput
              defaultValue={rules.maxAdvanceDays}
              type="number"
              className="max-w-[120px]"
            />
          </FieldRow>
          <FieldRow label="Buffer between appts (mins)">
            <TextInput defaultValue={rules.bufferMinutes} type="number" className="max-w-[120px]" />
          </FieldRow>
          <FieldRow label="Max daily bookings">
            <TextInput
              defaultValue={rules.maxDailyBookings}
              type="number"
              className="max-w-[120px]"
            />
          </FieldRow>
        </CardContent>
      </Card>

      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5 px-5">
          <CardTitle className="text-sm font-semibold text-muted uppercase tracking-wide text-[10px]">
            Cancellations & Deposits
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3 space-y-4">
          <FieldRow label="Cancellation window (hours)">
            <TextInput
              defaultValue={rules.cancelWindowHours}
              type="number"
              className="max-w-[120px]"
            />
          </FieldRow>
          <FieldRow label="Deposit amount (%)">
            <TextInput defaultValue={rules.depositPct} type="number" className="max-w-[120px]" />
          </FieldRow>
          <ToggleRow
            label="Require deposit"
            hint="Client must pay deposit to confirm booking"
            on={rules.depositRequired}
            onChange={() => toggleRule("depositRequired")}
          />
          <ToggleRow
            label="Allow online booking"
            hint="Clients can book directly from your booking link"
            on={rules.allowOnlineBooking}
            onChange={() => toggleRule("allowOnlineBooking")}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <SaveButton label="Save Rules" />
      </div>
    </div>
  );
}

function PoliciesTab() {
  const [policies] = useState(POLICIES);
  const [editing, setEditing] = useState<number | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Policies</h2>
          <p className="text-xs text-muted mt-0.5">
            Cancellation rules, aftercare instructions, and other policies
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-foreground bg-surface border border-border rounded-lg hover:bg-foreground/5 transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Add Policy
        </button>
      </div>

      <div className="space-y-3">
        {policies.map((policy) => (
          <Card key={policy.id} className="gap-0">
            <CardHeader className="pb-0 pt-4 px-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">{policy.type}</CardTitle>
                <button
                  onClick={() => setEditing(editing === policy.id ? null : policy.id)}
                  className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-foreground/5"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4 pt-2">
              {editing === policy.id ? (
                <div className="space-y-3">
                  <textarea
                    rows={4}
                    defaultValue={policy.body}
                    className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30 resize-none transition"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(null)}
                      className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Save
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="px-3 py-1.5 text-xs font-medium text-muted rounded-lg hover:bg-foreground/5 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted leading-relaxed">{policy.body}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function IntegrationsTab() {
  const categories = [...new Set(INTEGRATIONS.map((i) => i.category))];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Integrations</h2>
        <p className="text-xs text-muted mt-0.5">
          Connect your studio to the tools you already use
        </p>
      </div>

      {categories.map((cat) => (
        <div key={cat}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-2">{cat}</p>
          <div className="space-y-2">
            {INTEGRATIONS.filter((i) => i.category === cat).map((integration) => (
              <Card key={integration.name} className="gap-0">
                <CardContent className="px-5 py-4">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl shrink-0">{integration.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{integration.name}</p>
                        <span
                          className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                            integration.connected
                              ? "bg-[#4e6b51]/10 text-[#4e6b51] border-[#4e6b51]/20"
                              : "bg-foreground/5 text-muted border-foreground/10",
                          )}
                        >
                          {integration.connected ? "Connected" : "Not connected"}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-0.5">{integration.description}</p>
                    </div>
                    <button
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0",
                        integration.connected
                          ? "bg-surface border border-border text-muted hover:text-destructive hover:border-destructive/30"
                          : "bg-accent text-white hover:bg-accent/90",
                      )}
                    >
                      {integration.connected ? "Disconnect" : "Connect"}
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NotificationsTab() {
  const [prefs, setPrefs] = useState(NOTIFICATION_PREFS);

  function toggle(idx: number, channel: "email" | "sms") {
    setPrefs((prev) => prev.map((p, i) => (i === idx ? { ...p, [channel]: !p[channel] } : p)));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Notification Preferences</h2>
        <p className="text-xs text-muted mt-0.5">Choose how and when you get notified</p>
      </div>

      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5">
          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_80px] gap-x-4 mb-3 pb-2 border-b border-border/60">
            <span />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted text-center">
              Email
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted text-center">
              SMS
            </span>
          </div>
          <div className="space-y-1">
            {prefs.map((pref, idx) => (
              <div
                key={pref.label}
                className="grid grid-cols-[1fr_80px_80px] gap-x-4 items-center py-2.5 px-2 rounded-xl hover:bg-surface/60 transition-colors"
              >
                <span className="text-sm text-foreground">{pref.label}</span>
                <div className="flex justify-center">
                  <Toggle on={pref.email} onChange={() => toggle(idx, "email")} />
                </div>
                <div className="flex justify-center">
                  <Toggle on={pref.sms} onChange={() => toggle(idx, "sms")} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4 border-t border-border/50 mt-2">
            <SaveButton label="Save Preferences" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const AFTERCARE_SECTIONS = [
  {
    id: "lash",
    title: "Lash Extensions",
    dos: [
      "Keep lashes dry for 24\u201348 hours after appointment.",
      "Cleanse lashes 3\u20134\u00d7 per week with an oil-free lash cleanser.",
      "Brush lashes gently each morning with a clean spoolie.",
      "Sleep on your back or use a lash pillow to protect shape.",
      "Book your fill every 2\u20133 weeks to maintain fullness.",
    ],
    donts: [
      "Do not use oil-based products near the eye area.",
      "Do not pick, pull, or rub lashes \u2014 causes premature shedding.",
      "Avoid steam rooms, saunas, or prolonged hot showers for 48 hours.",
      "Do not use a mechanical eyelash curler.",
      "Avoid waterproof mascara on extensions.",
    ],
  },
  {
    id: "jewelry",
    title: "Permanent Jewelry",
    dos: [
      "Your jewelry is safe to shower, swim, and sleep in.",
      "Polish occasionally with a soft cloth to maintain shine.",
      "Visit the studio if the chain needs adjustment or re-welding.",
    ],
    donts: [
      "Avoid harsh chemicals like bleach, chlorine, or cleaning products.",
      "Do not apply lotions or perfumes directly onto the chain.",
      "Do not attempt to cut or remove at home \u2014 visit the studio.",
    ],
  },
  {
    id: "crochet",
    title: "Crochet & Braids",
    dos: [
      "Moisturize your scalp with a lightweight oil 2\u20133\u00d7 per week.",
      "Sleep with a satin bonnet or on a satin pillowcase.",
      "Wash style every 2\u20133 weeks using diluted shampoo or co-wash.",
    ],
    donts: [
      "Do not leave crochet styles in longer than 8 weeks.",
      "Avoid excess moisture or product buildup on extensions.",
      "Do not scratch aggressively \u2014 use a rat-tail comb for itching.",
    ],
  },
];

function AftercareTab() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Aftercare Instructions</h2>
        <p className="text-xs text-muted mt-0.5">
          Shown to clients after their appointment and on your booking page
        </p>
      </div>
      <div className="space-y-4">
        {AFTERCARE_SECTIONS.map((section) => (
          <Card key={section.id} className="gap-0">
            <CardHeader className="pb-0 pt-4 px-5">
              <CardTitle className="text-sm font-semibold">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#4e6b51] mb-2">
                    Do&apos;s
                  </p>
                  <ul className="space-y-1.5">
                    {section.dos.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-foreground leading-relaxed"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4e6b51] mt-1.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive mb-2">
                    Don&apos;ts
                  </p>
                  <ul className="space-y-1.5">
                    {section.donts.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-foreground leading-relaxed"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted">
        To edit aftercare content in detail, go to the Aftercare &amp; Policies page.
      </p>
    </div>
  );
}

const INITIAL_REMINDERS = [
  {
    id: 1,
    label: "Booking confirmation",
    timing: "Immediately after booking",
    email: true,
    sms: true,
    active: true,
  },
  {
    id: 2,
    label: "48-hour reminder",
    timing: "2 days before appointment",
    email: true,
    sms: true,
    active: true,
  },
  {
    id: 3,
    label: "24-hour reminder",
    timing: "1 day before appointment",
    email: false,
    sms: true,
    active: true,
  },
  {
    id: 4,
    label: "Day-of reminder",
    timing: "Morning of appointment",
    email: false,
    sms: true,
    active: false,
  },
  {
    id: 5,
    label: "4-week follow-up",
    timing: "28 days after appointment",
    email: true,
    sms: false,
    active: true,
  },
  {
    id: 6,
    label: "Review request",
    timing: "2 days after appointment",
    email: true,
    sms: false,
    active: true,
  },
];

function RemindersTab() {
  const [reminders, setReminders] = useState(INITIAL_REMINDERS);

  function toggleField(id: number, field: "email" | "sms" | "active") {
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: !r[field] } : r)));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Automated Reminders</h2>
        <p className="text-xs text-muted mt-0.5">
          Configure your client communication sequence. SMS is powered by Square.
        </p>
      </div>
      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5">
          <div className="grid grid-cols-[1fr_60px_60px_56px] gap-x-4 mb-3 pb-2 border-b border-border/60 items-center">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Step
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted text-center">
              Email
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted text-center">
              SMS
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted text-center">
              On
            </span>
          </div>
          <div className="space-y-1">
            {reminders.map((r) => (
              <div
                key={r.id}
                className={cn(
                  "grid grid-cols-[1fr_60px_60px_56px] gap-x-4 items-center py-3 px-2 rounded-xl transition-colors",
                  r.active ? "hover:bg-surface/60" : "opacity-50",
                )}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{r.label}</p>
                  <p className="text-xs text-muted mt-0.5">{r.timing}</p>
                </div>
                <div className="flex justify-center">
                  <Toggle on={r.email} onChange={() => toggleField(r.id, "email")} />
                </div>
                <div className="flex justify-center">
                  <Toggle on={r.sms} onChange={() => toggleField(r.id, "sms")} />
                </div>
                <div className="flex justify-center">
                  <Toggle on={r.active} onChange={() => toggleField(r.id, "active")} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4 border-t border-border/50 mt-2">
            <SaveButton label="Save Reminders" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function SettingsPage({
  initialHours,
  initialTimeOff,
  initialLunchBreak,
}: {
  initialHours: BusinessHourRow[];
  initialTimeOff: TimeOffRow[];
  initialLunchBreak: LunchBreak | null;
}) {
  const [tab, setTab] = useState<Tab>("business");

  const PANEL: Record<Tab, React.ReactNode> = {
    business: <BusinessTab />,
    hours: (
      <HoursTab
        initialHours={initialHours}
        initialTimeOff={initialTimeOff}
        initialLunchBreak={initialLunchBreak}
      />
    ),
    booking: <BookingTab />,
    policies: <PoliciesTab />,
    aftercare: <AftercareTab />,
    reminders: <RemindersTab />,
    integrations: <IntegrationsTab />,
    notifications: <NotificationsTab />,
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
        <div className="flex-1 min-w-0">
          {/* Mobile panel label shown only on md+ hidden above */}
          {PANEL[tab]}
        </div>
      </div>
    </div>
  );
}
