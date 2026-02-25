"use client";

import { useState } from "react";
import { CalendarOff, Check, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Section = "profile" | "availability" | "notifications" | "timeoff";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DEFAULT_AVAILABILITY: Record<string, { on: boolean; start: string; end: string }> = {
  Sunday: { on: false, start: "10:00", end: "17:00" },
  Monday: { on: false, start: "10:00", end: "17:00" },
  Tuesday: { on: true, start: "10:00", end: "18:00" },
  Wednesday: { on: true, start: "10:00", end: "18:00" },
  Thursday: { on: true, start: "10:00", end: "19:00" },
  Friday: { on: true, start: "10:00", end: "19:00" },
  Saturday: { on: true, start: "09:00", end: "17:00" },
};

type RequestStatus = "pending" | "approved" | "denied";

interface TimeOffRequest {
  id: number;
  from: string;
  to: string;
  reason: string;
  status: RequestStatus;
  submittedOn: string;
}

const INITIAL_REQUESTS: TimeOffRequest[] = [
  {
    id: 1,
    from: "2026-03-10",
    to: "2026-03-12",
    reason: "Family trip",
    status: "approved",
    submittedOn: "Feb 14",
  },
  {
    id: 2,
    from: "2026-04-18",
    to: "2026-04-18",
    reason: "Doctor's appointment",
    status: "pending",
    submittedOn: "Feb 19",
  },
];

const STATUS_CFG: Record<RequestStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" },
  approved: { label: "Approved", className: "bg-[#4e6b51]/10 text-[#4e6b51] border-[#4e6b51]/20" },
  denied: {
    label: "Denied",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

export function AssistantSettingsPage() {
  const [section, setSection] = useState<Section>("profile");
  const [profile, setProfile] = useState({
    name: "Jasmine Carter",
    phone: "(404) 555-0210",
    email: "jasmine.carter@tcreativestudio.com",
    bio: "Lead lash tech at T Creative Studio. Specializing in classic, hybrid, and volume lashes.",
    instagram: "@jasminecarterbeauty",
  });
  const [availability, setAvailability] = useState(DEFAULT_AVAILABILITY);
  const [notifications, setNotifications] = useState({
    newBooking: true,
    bookingReminder: true,
    cancellation: true,
    messageFromTrini: true,
    trainingDue: true,
    payoutProcessed: true,
    weeklyDigest: false,
  });
  const [saved, setSaved] = useState(false);

  // Time off
  const [requests, setRequests] = useState<TimeOffRequest[]>(INITIAL_REQUESTS);
  const [newFrom, setNewFrom] = useState("");
  const [newTo, setNewTo] = useState("");
  const [newReason, setNewReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function submitTimeOff() {
    if (!newFrom) return;
    const req: TimeOffRequest = {
      id: Date.now(),
      from: newFrom,
      to: newTo || newFrom,
      reason: newReason.trim() || "No reason provided",
      status: "pending",
      submittedOn: "Today",
    };
    setRequests((prev) => [req, ...prev]);
    setNewFrom("");
    setNewTo("");
    setNewReason("");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
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
                <label className="text-xs font-medium text-foreground">Full name</label>
                <input
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
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
                  onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Instagram</label>
                <input
                  value={profile.instagram}
                  onChange={(e) => setProfile((p) => ({ ...p, instagram: e.target.value }))}
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
                className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 resize-none transition"
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={save}
                className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
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
            {DAYS.map((day) => {
              const a = availability[day];
              return (
                <div key={day} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-28 shrink-0">
                    <button
                      onClick={() =>
                        setAvailability((prev) => ({
                          ...prev,
                          [day]: { ...prev[day], on: !prev[day].on },
                        }))
                      }
                      className={cn(
                        "w-8 h-4.5 rounded-full transition-colors relative shrink-0",
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
                      {day.slice(0, 3)}
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
                            [day]: { ...prev[day], start: e.target.value },
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
                            [day]: { ...prev[day], end: e.target.value },
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
                onClick={save}
                className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
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
              ] as { key: keyof typeof notifications; label: string }[]
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
                onClick={save}
                className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
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
                    onClick={submitTimeOff}
                    disabled={!newFrom}
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
                <p className="text-sm text-muted text-center py-8">No requests submitted yet.</p>
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
