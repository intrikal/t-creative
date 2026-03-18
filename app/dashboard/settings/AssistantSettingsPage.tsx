"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import {
  type Section,
  DAY_ORDER,
  ProfileSection,
  AvailabilitySection,
  type AvailabilityMap,
  NotificationsSection,
  TimeOffSection,
} from "./assistant-components";
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

/* ------------------------------------------------------------------ */
/*  Section tabs config                                                */
/* ------------------------------------------------------------------ */

const SECTIONS: { id: Section; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "availability", label: "Availability" },
  { id: "notifications", label: "Notifications" },
  { id: "timeoff", label: "Time Off" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

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
  const buildAvailMap = (): AvailabilityMap => {
    const map: AvailabilityMap = {};
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
  const [availability, setAvailability] = useState<AvailabilityMap>(buildAvailMap);

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

      {section === "profile" && (
        <ProfileSection
          profile={profile}
          onChange={(update) => setProfile((p) => ({ ...p, ...update }))}
          onSave={handleSaveProfile}
          isPending={isPending}
          saved={saved}
        />
      )}

      {section === "availability" && (
        <AvailabilitySection
          availability={availability}
          onChange={setAvailability}
          onSave={handleSaveAvailability}
          isPending={isPending}
          saved={saved}
        />
      )}

      {section === "notifications" && (
        <NotificationsSection
          notifications={notifications}
          onChange={setNotifications}
          onSave={handleSaveNotifications}
          isPending={isPending}
          saved={saved}
        />
      )}

      {section === "timeoff" && (
        <TimeOffSection
          requests={requests}
          newFrom={newFrom}
          newTo={newTo}
          newReason={newReason}
          submitted={submitted}
          onNewFromChange={setNewFrom}
          onNewToChange={setNewTo}
          onNewReasonChange={setNewReason}
          onSubmit={handleSubmitTimeOff}
          isPending={isPending}
        />
      )}
    </div>
  );
}
