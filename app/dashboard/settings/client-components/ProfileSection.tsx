"use client";

/**
 * ProfileSection.tsx — "My Profile" tab for the client settings page.
 *
 * Displays and allows editing of:
 * - First name, last name
 * - Phone number (E.164, updated immediately)
 * - Email (triggers Supabase auth email-change flow; shows "check inbox" banner)
 * - Birthday (date picker, stored in client_preferences.birthday)
 * - Preferred contact method (select, stored in client_preferences)
 *
 * Wired to the database via `updateClientProfile()` server action.
 *
 * ## Email change UX
 * When the user changes their email the action calls `supabase.auth.updateUser`
 * which sends a confirmation link to the new address. The profiles.email column
 * is NOT updated until the user confirms. The UI shows a "Check your inbox" banner
 * with the pending address until the page is reloaded after confirmation.
 */

import { useState, useTransition } from "react";
import { Camera, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { updateClientProfile } from "../client-settings-actions";
import type { ClientProfile } from "../client-settings-actions";
import { FieldRow, StatefulSaveButton, INPUT_CLASS } from "../components/shared";

const CONTACT_OPTIONS = ["", "text", "email", "instagram DM", "phone call"] as const;

const SELECT_CLASS =
  "w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30 transition";

export function ProfileSection({ initial }: { initial: ClientProfile }) {
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [birthday, setBirthday] = useState(initial.birthday);
  const [contactMethod, setContactMethod] = useState(initial.preferredContactMethod);

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailPending, setEmailPending] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateClientProfile({
        firstName,
        lastName,
        phone,
        email,
        birthday: birthday || null,
        preferredContactMethod:
          (contactMethod as "" | "text" | "email" | "instagram DM" | "phone call") || null,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      if (result.emailChangePending) {
        setEmailPending(email);
        // Show the current (old) email in the field until confirmed
        setEmail(initial.email);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  const initials =
    (firstName?.[0] ?? "").toUpperCase() + (lastName?.[0] ?? "").toUpperCase() || "?";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">My Profile</h2>
        <p className="text-xs text-muted mt-0.5">Your personal information</p>
      </div>

      {/* Email confirmation pending banner */}
      {emailPending && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-accent/5 border border-accent/20 text-sm">
          <Mail className="w-4 h-4 mt-0.5 text-accent shrink-0" />
          <p className="text-foreground">
            A confirmation link was sent to <strong className="font-medium">{emailPending}</strong>.
            Your email address will update once you click the link.
          </p>
        </div>
      )}

      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center">
                <span className="text-xl font-bold text-accent">{initials}</span>
              </div>
              <button
                aria-label="Change profile photo"
                className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center border-2 border-background hover:bg-foreground/80 transition-colors"
              >
                <Camera className="w-3 h-3" />
              </button>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {firstName} {lastName}
              </p>
              <p className="text-xs text-muted mt-0.5">{initial.email}</p>
              <button className="text-xs text-accent hover:underline mt-1">Upload photo</button>
            </div>
          </div>

          {/* Name + phone */}
          <div className="border-t border-border/50 pt-4 space-y-4">
            <FieldRow label="First Name">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={INPUT_CLASS}
              />
            </FieldRow>
            <FieldRow label="Last Name">
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={INPUT_CLASS}
              />
            </FieldRow>
            <FieldRow label="Phone">
              <input
                type="tel"
                placeholder="+12125551234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-[11px] text-muted">
                Used for appointment reminders via SMS. Include country code (e.g. +1).
              </p>
            </FieldRow>
          </div>

          {/* Email */}
          <div className="border-t border-border/50 pt-4 space-y-4">
            <FieldRow label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-[11px] text-muted">
                Changing your email sends a confirmation link to the new address.
              </p>
            </FieldRow>
          </div>

          {/* Birthday + contact method */}
          <div className="border-t border-border/50 pt-4 space-y-4">
            <FieldRow label="Birthday">
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-[11px] text-muted">
                Used for birthday promotions and loyalty rewards.
              </p>
            </FieldRow>
            <FieldRow label="Preferred Contact">
              <select
                value={contactMethod}
                onChange={(e) => setContactMethod(e.target.value)}
                className={SELECT_CLASS}
              >
                {CONTACT_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m ? m.charAt(0).toUpperCase() + m.slice(1) : "Select…"}
                  </option>
                ))}
              </select>
            </FieldRow>
          </div>

          {/* Error */}
          {error && <p className="text-xs text-red-600 px-1">{error}</p>}

          {/* Save */}
          <div className="border-t border-border/50 pt-4 flex justify-end">
            <StatefulSaveButton saving={isPending} saved={saved} onSave={handleSave} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
