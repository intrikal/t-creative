"use client";

import { useState, useTransition } from "react";
import { CalendarOff, Check, Clock, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  AssistantSettingsData,
  DayAvailability,
  NotificationPrefs,
  TimeOffRequest,
} from "./assistant-settings-actions";
import {
  saveAssistantProfile,
  saveAssistantAvailability,
  saveAssistantNotifications,
  submitTimeOffRequest,
} from "./assistant-settings-actions";

type Section = "profile" | "availability" | "notifications" | "timeoff";

// ISO dayOfWeek → label (1=Mon, 7=Sun)
const DAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

const DAY_ORDER = [7, 1, 2, 3, 4, 5, 6]; // Display Sun–Sat

type RequestStatus = "pending" | "approved" | "denied";

const STATUS_CFG: Record<RequestStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" },
  approved: {
    label: "Approved",
    className: "bg-[#4e6b51]/10 text-[#4e6b51] border-[#4e6b51]/20",
  },
  denied: {
    label: "Denied",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

export function AssistantSettingsPage({ data }: { data: AssistantSettingsData }) {
  const [section, setSection] = useState<Section>("profile");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  // Profile state
  const [profile, setProfile] = useState({
    firstName: data.profile.firstName,
    lastName: data.profile.lastName,
    phone: data.profile.phone,
    email: data.profile.email,
    bio: data.profile.bio,
    instagram: data.profile.instagram,
  });

  // Availability state — build a map keyed by dayOfWeek
  const buildAvailMap = () => {
    const map: Record<number, { on: boolean; start: string; end: string }> = {};
    for (const d of data.availability) {
      map[d.dayOfWeek] = {
        on: d.isOpen,
        start: d.opensAt ?? "10:00",
        end: d.closesAt ?? "17:00",
      };
    }
    // Ensure all 7 days exist
    for (const dow of DAY_ORDER) {
      if (!map[dow]) {
        map[dow] = { on: false, start: "10:00", end: "17:00" };
      }
    }
    return map;
  };
  const [availability, setAvailability] = useState(buildAvailMap);

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationPrefs>(data.notifications);

  // Time off state
  const [requests, setRequests] = useState<TimeOffRequest[]>(data.timeOffRequests);
  const [newFrom, setNewFrom] = useState("");
  const [newTo, setNewTo] = useState("");
  const [newReason, setNewReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function showSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleSaveProfile() {
    showSaved();
    startTransition(async () => {
      await saveAssistantProfile({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        bio: profile.bio,
        instagram: profile.instagram,
      });
    });
  }

  function handleSaveAvailability() {
    showSaved();
    const days: DayAvailability[] = DAY_ORDER.map((dow) => ({
      dayOfWeek: dow,
      isOpen: availability[dow].on,
      opensAt: availability[dow].on ? availability[dow].start : null,
      closesAt: availability[dow].on ? availability[dow].end : null,
    }));
    startTransition(async () => {
      await saveAssistantAvailability(days);
    });
  }

  function handleSaveNotifications() {
    showSaved();
    startTransition(async () => {
      await saveAssistantNotifications(notifications);
    });
  }

  function handleSubmitTimeOff() {
    if (!newFrom) return;
    const toDate = newTo || newFrom;
    const reason = newReason.trim() || "No reason provided";

    // Optimistic update
    const req: TimeOffRequest = {
      id: Date.now(),
      from: newFrom,
      to: toDate,
      reason,
      status: "pending",
      submittedOn: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
    setRequests((prev) => [req, ...prev]);
    setNewFrom("");
    setNewTo("");
    setNewReason("");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);

    startTransition(async () => {
      await submitTimeOffRequest({ from: newFrom, to: toDate, reason });
    });
  }

  function fmtDate(d: string) {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${months[parseInt(m) - 1]} ${parseInt(day)}, ${y}`;
  }

  const SECTIONS: { id: Section; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "availability", label: "Availability" },
    { id: "notifications", label: "Notifications" },
    { id: "timeoff", label: "Time Off" },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Manage your profile and preferences</p>
      </div>

      {/* Section tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px shrink-0",
              section === s.id
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Profile */}
      {section === "profile" && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Profile Information</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">First name</label>
                <input
                  value={profile.firstName}
                  onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Last name</label>
                <input
                  value={profile.lastName}
                  onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Phone</label>
                <input
                  value={profile.phone}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Email</label>
                <input
                  value={profile.email}
                  readOnly
                  className="w-full px-3 py-2 text-sm bg-surface/50 border border-border rounded-lg text-muted cursor-not-allowed"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Instagram</label>
                <input
                  value={profile.instagram}
                  onChange={(e) => setProfile((p) => ({ ...p, instagram: e.target.value }))}
                  placeholder="@handle"
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Bio</label>
              <textarea
                value={profile.bio}
                onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
                rows={3}
                placeholder="Tell clients about yourself…"
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none transition"
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveProfile}
                disabled={isPending}
                className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60"
              >
                {saved ? "Saved!" : "Save changes"}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Availability */}
      {section === "availability" && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Weekly Availability</CardTitle>
            <p className="text-xs text-muted mt-0.5">
              Set your regular working hours. Trini uses this for scheduling.
            </p>
          </CardHeader>
          <CardContent className="px-5 py-4 space-y-3">
            {DAY_ORDER.map((dow) => {
              const a = availability[dow];
              const label = DAY_LABELS[dow];
              return (
                <div key={dow} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-28 shrink-0">
                    <button
                      onClick={() =>
                        setAvailability((prev) => ({
                          ...prev,
                          [dow]: { ...prev[dow], on: !prev[dow].on },
                        }))
                      }
                      className={cn(
                        "w-8 rounded-full transition-colors relative shrink-0",
                        a.on ? "bg-accent" : "bg-foreground/15",
                      )}
                      style={{ height: "18px", width: "32px" }}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform",
                          a.on ? "translate-x-4" : "translate-x-0.5",
                        )}
                      />
                    </button>
                    <span
                      className={cn("text-xs font-medium", a.on ? "text-foreground" : "text-muted")}
                    >
                      {label}
                    </span>
                  </div>
                  {a.on ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        value={a.start}
                        onChange={(e) =>
                          setAvailability((prev) => ({
                            ...prev,
                            [dow]: { ...prev[dow], start: e.target.value },
                          }))
                        }
                        className="px-2 py-1 text-xs bg-surface border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
                      />
                      <span className="text-xs text-muted">to</span>
                      <input
                        type="time"
                        value={a.end}
                        onChange={(e) =>
                          setAvailability((prev) => ({
                            ...prev,
                            [dow]: { ...prev[dow], end: e.target.value },
                          }))
                        }
                        className="px-2 py-1 text-xs bg-surface border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-muted/50 italic">Off</span>
                  )}
                </div>
              );
            })}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveAvailability}
                disabled={isPending}
                className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60"
              >
                {saved ? "Saved!" : "Save availability"}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications */}
      {section === "notifications" && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4 space-y-1">
            {(
              [
                { key: "newBooking", label: "New booking added to my schedule" },
                { key: "bookingReminder", label: "Appointment reminders (1 hour before)" },
                { key: "cancellation", label: "Booking cancellations or changes" },
                { key: "messageFromTrini", label: "New messages from Trini" },
                { key: "trainingDue", label: "Training module due soon" },
                { key: "payoutProcessed", label: "Payout processed" },
                { key: "weeklyDigest", label: "Weekly earnings digest" },
              ] as { key: keyof NotificationPrefs; label: string }[]
            ).map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between py-3 border-b border-border/40 last:border-0"
              >
                <span className="text-sm text-foreground">{item.label}</span>
                <button
                  onClick={() =>
                    setNotifications((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                  }
                  className={cn(
                    "w-8 rounded-full transition-colors relative shrink-0",
                    notifications[item.key] ? "bg-accent" : "bg-foreground/15",
                  )}
                  style={{ height: "18px", width: "32px" }}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform",
                      notifications[item.key] ? "translate-x-4" : "translate-x-0.5",
                    )}
                  />
                </button>
              </div>
            ))}
            <div className="flex justify-end pt-3">
              <button
                onClick={handleSaveNotifications}
                disabled={isPending}
                className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60"
              >
                {saved ? "Saved!" : "Save preferences"}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time Off */}
      {section === "timeoff" && (
        <div className="space-y-4">
          {/* Submit new request */}
          <Card className="gap-0">
            <CardHeader className="pb-0 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarOff className="w-4 h-4 text-muted" /> Request Time Off
              </CardTitle>
              <p className="text-xs text-muted mt-0.5">
                Requests go directly to Trini for approval.
              </p>
            </CardHeader>
            <CardContent className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">From date</label>
                  <input
                    type="date"
                    value={newFrom}
                    onChange={(e) => setNewFrom(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    To date <span className="text-muted font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={newTo}
                    min={newFrom}
                    onChange={(e) => setNewTo(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Reason <span className="text-muted font-normal">(optional)</span>
                </label>
                <input
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="e.g. Family event, Doctor's appointment…"
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                {submitted && (
                  <p className="text-xs text-[#4e6b51] flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Request sent to Trini!
                  </p>
                )}
                <div className="ml-auto">
                  <button
                    onClick={handleSubmitTimeOff}
                    disabled={!newFrom || isPending}
                    className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-40"
                  >
                    Submit request
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Past requests */}
          <Card className="gap-0">
            <CardHeader className="pb-0 pt-4 px-5">
              <CardTitle className="text-sm font-semibold">Your Requests</CardTitle>
            </CardHeader>
            <CardContent className="px-0 py-0">
              {requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <Settings2 className="w-8 h-8 text-foreground/15 mb-2" />
                  <p className="text-sm text-muted">No requests submitted yet.</p>
                </div>
              ) : (
                requests.map((r) => {
                  const cfg = STATUS_CFG[r.status];
                  const isSingleDay = r.from === r.to;
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-4 px-5 py-3.5 border-b border-border/40 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-muted" />
                            {isSingleDay
                              ? fmtDate(r.from)
                              : `${fmtDate(r.from)} – ${fmtDate(r.to)}`}
                          </span>
                        </div>
                        <p className="text-xs text-muted mt-0.5">
                          {r.reason} · Submitted {r.submittedOn}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0",
                          cfg.className,
                        )}
                      >
                        {cfg.label}
                      </span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
