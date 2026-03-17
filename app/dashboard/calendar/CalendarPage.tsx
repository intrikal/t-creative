/**
 * @file CalendarPage.tsx
 * @description Page shell for the Calendar feature — tab bar, toolbar,
 *              view switching, and mutation handlers. Delegates rendering
 *              to child components in ./components/.
 */

"use client";

import { useState, useMemo, useOptimistic, useTransition } from "react";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, MapPin, Users, Trash2 } from "lucide-react";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { createBooking, updateBooking, deleteBooking } from "../bookings/actions";
import {
  saveBusinessHours,
  saveLunchBreak,
  addTimeOff,
  deleteTimeOff,
} from "../settings/hours-actions";
import { AgendaView } from "./components/AgendaView";
import type { CalPageTab } from "./components/constants";
import {
  VIEWS,
  CAL_PAGE_TABS,
  BLANK_FORM,
  AVAIL_DAY_NAMES,
  TIME_OPTIONS,
  EVENT_TYPE_CFG,
  EVENT_STATUS_CFG,
} from "./components/constants";
import { DayView } from "./components/DayView";
import { EventDetailDialog } from "./components/EventDetailDialog";
import { EventFormDialog } from "./components/EventFormDialog";
import {
  fmtDate,
  parseDate,
  fmtDateISO,
  mapBookingToCalEvent,
  categoryToEventType,
  navigate,
  periodLabel,
  fmtEventRange,
} from "./components/helpers";
import { MonthView } from "./components/MonthView";
import { StaffView } from "./components/StaffView";
import type {
  CalEvent,
  FormState,
  View,
  BookingRow,
  EventRow,
  BusinessHourRow,
  TimeOffRow,
  LunchBreak,
} from "./components/types";
import { WeekView } from "./components/WeekView";

/* ------------------------------------------------------------------ */
/*  Availability-editor sub-components                                 */
/* ------------------------------------------------------------------ */

function TimeSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "px-2.5 py-1.5 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30 transition appearance-none cursor-pointer",
        className,
      )}
    >
      {TIME_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function AvailToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={cn(
        "relative w-10 h-[22px] rounded-full overflow-hidden transition-colors shrink-0",
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
/*  AvailabilityTab                                                    */
/* ------------------------------------------------------------------ */

function AvailabilityTab({
  businessHours,
  timeOff: initialTimeOff,
  lunchBreak: initialLunchBreak,
}: {
  businessHours: BusinessHourRow[];
  timeOff: TimeOffRow[];
  lunchBreak: LunchBreak | null;
}) {
  const [days, setDays] = useState(() =>
    [...businessHours]
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map((h) => ({
        id: h.id,
        dayOfWeek: h.dayOfWeek,
        isOpen: h.isOpen,
        opensAt: h.opensAt ?? "09:00",
        closesAt: h.closesAt ?? "18:00",
      })),
  );
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursSaved, setHoursSaved] = useState(false);

  const [lunch, setLunch] = useState<LunchBreak>(
    initialLunchBreak ?? { enabled: false, start: "12:00", end: "13:00" },
  );
  const [lunchSaving, setLunchSaving] = useState(false);
  const [lunchSaved, setLunchSaved] = useState(false);

  const [isBlockedPending, startBlockedTransition] = useTransition();
  const [blocked, addBlockedOptimistic] = useOptimistic<
    TimeOffRow[],
    { type: "add"; row: TimeOffRow } | { type: "delete"; id: number }
  >(initialTimeOff, (state, action) => {
    switch (action.type) {
      case "add":
        return [...state, action.row];
      case "delete":
        return state.filter((b) => b.id !== action.id);
    }
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState<"day_off" | "vacation">("day_off");
  const [addStart, setAddStart] = useState("");
  const [addEnd, setAddEnd] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [adding, setAdding] = useState(false);

  const openDays = days.filter((d) => d.isOpen);

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
      setShowAddForm(false);
      setAddStart("");
      setAddEnd("");
      setAddLabel("");
      startBlockedTransition(() => {
        addBlockedOptimistic({ type: "add", row });
      });
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteBlocked(id: number) {
    startBlockedTransition(async () => {
      addBlockedOptimistic({ type: "delete", id });
      await deleteTimeOff(id);
    });
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">Studio Availability</h2>
          <p className="text-xs text-muted mt-0.5">
            {openDays.length} day{openDays.length !== 1 ? "s" : ""} open per week
          </p>
        </div>

        {/* Weekly Schedule */}
        <div className="bg-background border border-border rounded-2xl overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Weekly Schedule
            </p>
          </div>
          <div className="px-5 pb-4 space-y-0.5">
            {days.map((row, idx) => (
              <div
                key={row.dayOfWeek}
                className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-surface/60 transition-colors"
              >
                <span
                  className={cn(
                    "text-sm w-24 shrink-0 font-medium",
                    row.isOpen ? "text-foreground" : "text-muted/50",
                  )}
                >
                  {AVAIL_DAY_NAMES[row.dayOfWeek]}
                </span>
                <div className="flex-1 flex items-center gap-2">
                  {row.isOpen ? (
                    <>
                      <TimeSelect
                        value={row.opensAt}
                        onChange={(v) =>
                          setDays((prev) =>
                            prev.map((d, i) => (i === idx ? { ...d, opensAt: v } : d)),
                          )
                        }
                      />
                      <span className="text-muted text-xs shrink-0">to</span>
                      <TimeSelect
                        value={row.closesAt}
                        onChange={(v) =>
                          setDays((prev) =>
                            prev.map((d, i) => (i === idx ? { ...d, closesAt: v } : d)),
                          )
                        }
                      />
                    </>
                  ) : (
                    <span className="text-sm text-muted/40 italic">Closed</span>
                  )}
                </div>
                <AvailToggle
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
                {hoursSaved ? "Saved!" : hoursSaving ? "Saving…" : "Save Hours"}
              </button>
            </div>
          </div>
        </div>

        {/* Lunch Break */}
        <div className="bg-background border border-border rounded-2xl overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Lunch Break
            </p>
          </div>
          <div className="px-5 pb-4 space-y-3">
            <div className="flex items-center justify-between gap-4 py-0.5">
              <div className="min-w-0">
                <p className="text-sm text-foreground">Block lunch break</p>
                <p className="text-xs text-muted mt-0.5">
                  Prevent bookings during your lunch window
                </p>
              </div>
              <AvailToggle
                on={lunch.enabled}
                onChange={(v) => setLunch((prev) => ({ ...prev, enabled: v }))}
              />
            </div>
            {lunch.enabled && (
              <div className="flex items-center gap-3 pl-1">
                <TimeSelect
                  value={lunch.start}
                  onChange={(v) => setLunch((prev) => ({ ...prev, start: v }))}
                />
                <span className="text-muted text-xs shrink-0">to</span>
                <TimeSelect
                  value={lunch.end}
                  onChange={(v) => setLunch((prev) => ({ ...prev, end: v }))}
                />
              </div>
            )}
            <div className="flex justify-end pt-2 border-t border-border/50">
              <button
                onClick={handleSaveLunch}
                disabled={lunchSaving}
                className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                {lunchSaved ? "Saved!" : lunchSaving ? "Saving…" : "Save Lunch Break"}
              </button>
            </div>
          </div>
        </div>

        {/* Blocked Dates */}
        <div className="bg-background border border-border rounded-2xl overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Blocked Dates
              </p>
              <button
                onClick={() => setShowAddForm((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-foreground/5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>
          <div className="px-5 pb-4 space-y-3">
            {showAddForm && (
              <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
                {/* Type toggle */}
                <div className="flex gap-2">
                  {(["day_off", "vacation"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setAddType(t);
                        if (t === "day_off") setAddEnd("");
                      }}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                        addType === t
                          ? "bg-accent text-white"
                          : "bg-foreground/5 text-muted hover:text-foreground",
                      )}
                    >
                      {t === "day_off" ? "Day Off" : "Vacation"}
                    </button>
                  ))}
                </div>

                {/* Calendar picker */}
                <div className="flex justify-center">
                  {addType === "day_off" ? (
                    <DatePicker
                      mode="single"
                      selected={addStart ? parseDate(addStart) : undefined}
                      onSelect={(day) => {
                        setAddStart(day ? fmtDateISO(day) : "");
                        setAddEnd("");
                      }}
                      disabled={{ before: new Date() }}
                      className="!bg-transparent"
                    />
                  ) : (
                    <DatePicker
                      mode="range"
                      selected={
                        addStart
                          ? {
                              from: parseDate(addStart),
                              to: addEnd ? parseDate(addEnd) : undefined,
                            }
                          : undefined
                      }
                      onSelect={(range) => {
                        setAddStart(range?.from ? fmtDateISO(range.from) : "");
                        setAddEnd(range?.to ? fmtDateISO(range.to) : "");
                      }}
                      disabled={{ before: new Date() }}
                      className="!bg-transparent"
                    />
                  )}
                </div>

                {/* Selected date display + label */}
                {addStart && (
                  <div className="space-y-3">
                    <p className="text-sm text-foreground text-center">
                      {addType === "day_off"
                        ? parseDate(addStart).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : addEnd
                          ? `${parseDate(addStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${parseDate(addEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                          : `Starting ${parseDate(addStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — select end date`}
                    </p>
                    <input
                      type="text"
                      value={addLabel}
                      onChange={(e) => setAddLabel(e.target.value)}
                      placeholder="Label (optional) — e.g. Hawaii trip"
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30"
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setAddStart("");
                      setAddEnd("");
                      setAddLabel("");
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-muted rounded-lg hover:bg-foreground/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddBlocked}
                    disabled={!addStart || (addType === "vacation" && !addEnd) || adding}
                    className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60"
                  >
                    {adding ? "Adding…" : addType === "day_off" ? "Block Day" : "Block Dates"}
                  </button>
                </div>
              </div>
            )}

            {blocked.length === 0 && !showAddForm && (
              <p className="text-sm text-muted/50 italic text-center py-4">
                No blocked dates — your schedule is fully open.
              </p>
            )}

            {blocked.map((entry) => {
              const startD = parseDate(entry.startDate);
              const endD = parseDate(entry.endDate);
              const sameDay = entry.startDate === entry.endDate;
              const fmtD = (d: Date) =>
                d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              return (
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
                      {sameDay ? fmtD(startD) : `${fmtD(startD)} – ${fmtD(endD)}`}
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
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EventsTab                                                          */
/* ------------------------------------------------------------------ */

function EventsTab({ events }: { events: EventRow[] }) {
  const upcoming = events.filter(
    (e) => e.status === "upcoming" || e.status === "confirmed" || e.status === "draft",
  );
  const past = events.filter((e) => e.status === "completed" || e.status === "cancelled");

  const totalGuests = upcoming.reduce((s, e) => s + e.guests.length, 0);
  const totalRevenue = upcoming.reduce((s, e) => s + (e.expectedRevenueInCents ?? 0), 0);

  function EventCard({ ev }: { ev: EventRow }) {
    const typeCfg = EVENT_TYPE_CFG[ev.eventType] ?? EVENT_TYPE_CFG.workshop;
    const statusCfg = EVENT_STATUS_CFG[ev.status] ?? EVENT_STATUS_CFG.draft;
    const guestCount = ev.guests.length;
    const maxAtt = ev.maxAttendees ?? 0;
    const fillPct = maxAtt > 0 ? Math.round((guestCount / maxAtt) * 100) : 0;

    return (
      <div className="group bg-background border border-border rounded-2xl p-4 flex flex-col gap-3 hover:shadow-sm transition-all">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                statusCfg.color,
                statusCfg.bg,
                statusCfg.border,
              )}
            >
              {statusCfg.label}
            </span>
            <span
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                typeCfg.color,
                typeCfg.bg,
                typeCfg.border,
              )}
            >
              {typeCfg.label}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-foreground leading-tight">{ev.title}</h3>
        </div>

        {ev.description && (
          <p className="text-xs text-muted leading-relaxed line-clamp-2">{ev.description}</p>
        )}

        <div className="space-y-1.5 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
            <span>{fmtEventRange(ev.startsAt, ev.endsAt)}</span>
          </div>
          {ev.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {ev.location}
                {ev.address ? ` · ${ev.address}` : ""}
              </span>
            </div>
          )}
        </div>

        {maxAtt > 0 && (
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/40">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[10px] text-muted mb-1">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {guestCount}/{maxAtt} guests
                </span>
                <span>{fillPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-foreground/8 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    fillPct >= 100 ? "bg-[#a07040]" : "bg-[#4e6b51]",
                  )}
                  style={{ width: `${Math.min(fillPct, 100)}%` }}
                />
              </div>
            </div>
            {ev.expectedRevenueInCents != null && ev.expectedRevenueInCents > 0 && (
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-foreground">
                  ${(ev.expectedRevenueInCents / 100).toLocaleString()}
                </p>
                <p className="text-[10px] text-muted">expected</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Events</h2>
          <p className="text-xs text-muted mt-0.5">
            Pop-ups, workshops, training days, and parties.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-background border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted uppercase tracking-wide font-medium">Upcoming</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{upcoming.length}</p>
        </div>
        <div className="bg-background border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted uppercase tracking-wide font-medium">Total Guests</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{totalGuests}</p>
        </div>
        <div className="bg-background border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted uppercase tracking-wide font-medium">
            Expected Revenue
          </p>
          <p className="text-2xl font-semibold text-foreground mt-1">
            ${(totalRevenue / 100).toLocaleString()}
          </p>
        </div>
      </div>

      {events.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted">No events yet. Create one from the Events page.</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Upcoming</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {upcoming.map((ev) => (
              <EventCard key={ev.id} ev={ev} />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Past</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {past.map((ev) => (
              <EventCard key={ev.id} ev={ev} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CalendarPage                                                       */
/* ------------------------------------------------------------------ */

const TODAY = fmtDate(new Date());

export function CalendarPage({
  initialBookings,
  clients,
  serviceOptions,
  staffOptions,
  businessHours,
  timeOff,
  lunchBreak,
  events: initialEventRows,
}: {
  initialBookings: BookingRow[];
  clients: { id: string; name: string; phone: string | null }[];
  serviceOptions: {
    id: number;
    name: string;
    category: string;
    durationMinutes: number;
    priceInCents: number;
  }[];
  staffOptions: { id: string; name: string }[];
  businessHours: BusinessHourRow[];
  timeOff: TimeOffRow[];
  lunchBreak: LunchBreak | null;
  events: EventRow[];
}) {
  const staffMembers = useMemo(() => staffOptions.map((s) => s.name), [staffOptions]);

  const serverEvents = useMemo(() => {
    const active = initialBookings.filter(
      (b) => b.status !== "cancelled" && b.status !== "no_show",
    );
    return active.map(mapBookingToCalEvent);
  }, [initialBookings]);

  const [isPending, startTransition] = useTransition();
  const [events, addOptimistic] = useOptimistic<CalEvent[], { type: "delete"; id: number }>(
    serverEvents,
    (state, action) => {
      switch (action.type) {
        case "delete":
          return state.filter((e) => e.id !== action.id);
      }
    },
  );

  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState<Date>(() => parseDate(TODAY));
  const [calPageTab, setCalPageTab] = useState<CalPageTab>("calendar");

  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CalEvent | null>(null);
  const [formInitial, setFormInitial] = useState<FormState>(BLANK_FORM);

  const openNew = (prefill?: Partial<FormState>) => {
    setEditTarget(null);
    setFormInitial({ ...BLANK_FORM, ...prefill });
    setFormOpen(true);
    setSelectedEvent(null);
  };

  const openEdit = (ev: CalEvent) => {
    setEditTarget(ev);
    setFormInitial({
      title: ev.title,
      type: ev.type,
      date: ev.date,
      startTime: ev.startTime,
      durationMin: ev.durationMin,
      staff: ev.staff ?? "",
      client: ev.client ?? "",
      location: ev.location ?? "",
      notes: ev.notes ?? "",
      serviceId: ev.serviceId ?? "",
      clientId: ev.clientId ?? "",
      staffId: ev.staffId ?? "",
    });
    setSelectedEvent(null);
    setFormOpen(true);
  };

  const handleSave = async (f: FormState) => {
    const startsAt = new Date(`${f.date}T${f.startTime}`);
    const svc = serviceOptions.find((s) => s.id === f.serviceId);
    const totalInCents = svc ? svc.priceInCents : 0;

    setFormOpen(false);
    if (editTarget && editTarget.bookingId) {
      startTransition(async () => {
        await updateBooking(editTarget.bookingId!, {
          clientId: f.clientId,
          serviceId: Number(f.serviceId),
          staffId: f.staffId || null,
          startsAt,
          durationMinutes: f.durationMin,
          totalInCents,
          location: f.location || undefined,
          clientNotes: f.notes || undefined,
          status: editTarget.status as
            | "confirmed"
            | "pending"
            | "completed"
            | "in_progress"
            | "cancelled"
            | "no_show",
        });
      });
    } else if (f.serviceId && f.clientId) {
      startTransition(async () => {
        await createBooking({
          clientId: f.clientId,
          serviceId: Number(f.serviceId),
          staffId: f.staffId || null,
          startsAt,
          durationMinutes: f.durationMin,
          totalInCents,
          location: f.location || undefined,
          clientNotes: f.notes || undefined,
        });
      });
    }
  };

  const handleDelete = async (ev: CalEvent) => {
    setSelectedEvent(null);
    if (ev.bookingId) {
      startTransition(async () => {
        addOptimistic({ type: "delete", id: ev.id });
        await deleteBooking(ev.bookingId!);
      });
    }
  };

  const handleSlotClick = (date: string, h: number, staff?: string) => {
    const staffOpt = staff ? staffOptions.find((s) => s.name === staff) : undefined;
    openNew({
      date,
      startTime: `${String(h).padStart(2, "0")}:00`,
      ...(staffOpt ? { staff: staffOpt.name, staffId: staffOpt.id } : {}),
    });
  };

  const handleDayClick = (d: Date) => {
    setCursor(d);
    setView("day");
  };

  /* ---- Non-calendar tabs ---- */
  if (calPageTab === "availability" || calPageTab === "events") {
    return (
      <div className="flex flex-col min-h-full">
        {/* Top tab bar */}
        <div className="flex gap-1 border-b border-border px-4 md:px-6 lg:px-8 pt-4 shrink-0">
          {CAL_PAGE_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setCalPageTab(id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                calPageTab === id
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-foreground hover:border-border",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {calPageTab === "availability" ? (
          <AvailabilityTab
            businessHours={businessHours}
            timeOff={timeOff}
            lunchBreak={lunchBreak}
          />
        ) : (
          <EventsTab events={initialEventRows} />
        )}
      </div>
    );
  }

  /* ---- Calendar tab ---- */
  return (
    <div className="flex flex-col h-screen max-w-[1600px] mx-auto w-full px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-4 gap-4">
      {/* ---- Tab bar ---- */}
      <div className="flex gap-1 border-b border-border -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 shrink-0">
        {CAL_PAGE_TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setCalPageTab(id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              calPageTab === id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground hover:border-border",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ---- Toolbar ---- */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(navigate(view, cursor, -1))}
            className="p-1.5 rounded-lg hover:bg-foreground/8 text-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCursor(parseDate(TODAY))}
            className="px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground rounded-lg hover:bg-foreground/8 border border-border transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(navigate(view, cursor, 1))}
            className="p-1.5 rounded-lg hover:bg-foreground/8 text-muted transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <h2 className="text-base font-semibold text-foreground tracking-tight flex-1 min-w-0 truncate">
          {periodLabel(view, cursor)}
        </h2>

        {/* View tabs */}
        <div className="flex gap-0.5 bg-surface border border-border rounded-lg p-0.5 shrink-0">
          {VIEWS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                view === key ? "bg-foreground text-background" : "text-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* New event */}
        <button
          onClick={() => openNew({ date: fmtDate(cursor) })}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      {/* ---- Calendar body ---- */}
      <div className="flex-1 min-h-0 border border-border rounded-2xl overflow-hidden bg-background flex flex-col">
        {view === "month" && (
          <MonthView
            cursor={cursor}
            events={events}
            onDayClick={handleDayClick}
            onEventClick={setSelectedEvent}
            businessHours={businessHours}
            timeOff={timeOff}
            lunchBreak={lunchBreak}
          />
        )}
        {view === "week" && (
          <WeekView
            cursor={cursor}
            events={events}
            onEventClick={setSelectedEvent}
            onSlotClick={handleSlotClick}
            businessHours={businessHours}
            timeOff={timeOff}
            lunchBreak={lunchBreak}
          />
        )}
        {view === "day" && (
          <DayView
            cursor={cursor}
            events={events}
            onEventClick={setSelectedEvent}
            onSlotClick={handleSlotClick}
            businessHours={businessHours}
            timeOff={timeOff}
            lunchBreak={lunchBreak}
          />
        )}
        {view === "staff" && (
          <StaffView
            cursor={cursor}
            events={events}
            staffMembers={staffMembers}
            onEventClick={setSelectedEvent}
            onSlotClick={handleSlotClick}
            businessHours={businessHours}
            timeOff={timeOff}
            lunchBreak={lunchBreak}
          />
        )}
        {view === "agenda" && (
          <AgendaView cursor={cursor} events={events} onEventClick={setSelectedEvent} />
        )}
      </div>

      {/* ---- Event detail dialog ---- */}
      {selectedEvent && (
        <EventDetailDialog
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEdit={() => openEdit(selectedEvent)}
          onDelete={() => handleDelete(selectedEvent)}
        />
      )}

      {/* ---- Event form dialog ---- */}
      {formOpen && (
        <EventFormDialog
          key={editTarget?.id ?? "new"}
          open
          title={editTarget ? "Edit Booking" : "New Booking"}
          initial={formInitial}
          onClose={() => setFormOpen(false)}
          onSave={handleSave}
          clients={clients}
          serviceOptions={serviceOptions}
          staffOptions={staffOptions}
        />
      )}
    </div>
  );
}
