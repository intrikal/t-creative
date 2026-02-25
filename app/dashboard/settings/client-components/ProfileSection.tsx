"use client";

/**
 * ProfileSection.tsx — Profile tab for the client settings page.
 *
 * Displays and allows editing of:
 * - Avatar with upload button (Phase 2: uploads to Supabase Storage)
 * - Full name, phone
 * - Allergies & notes shared with stylist before each appointment
 *
 * Wired to the database via `saveClientProfile()` server action.
 */

import { useState, useTransition } from "react";
import { Camera } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { saveClientProfile } from "../client-settings-actions";
import type { ClientProfile } from "../client-settings-actions";
import { FieldRow, StatefulSaveButton, INPUT_CLASS } from "../components/shared";

export function ProfileSection({ initial }: { initial: ClientProfile }) {
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [phone, setPhone] = useState(initial.phone);
  const [allergies, setAllergies] = useState(initial.allergies);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    startTransition(async () => {
      await saveClientProfile({
        firstName,
        lastName,
        phone,
        allergies,
      });
    });
  }

  const initials =
    (firstName?.[0] ?? "").toUpperCase() + (lastName?.[0] ?? "").toUpperCase() || "?";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Profile</h2>
        <p className="text-xs text-muted mt-0.5">Your personal information</p>
      </div>

      <Card className="gap-0">
        <CardContent className="px-5 pb-5 pt-5 space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center">
                <span className="text-xl font-bold text-accent">{initials}</span>
              </div>
              <button className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center border-2 border-background hover:bg-foreground/80 transition-colors">
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
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={INPUT_CLASS}
              />
            </FieldRow>
          </div>

          {/* Allergies & notes */}
          <div className="border-t border-border/50 pt-4 space-y-2">
            <FieldRow label="Allergies & Notes">
              <textarea
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                rows={3}
                className={INPUT_CLASS + " resize-none"}
              />
            </FieldRow>
            <p className="text-[11px] text-muted sm:ml-48">
              This info is shared with your stylist before each appointment.
            </p>
          </div>

          {/* Save */}
          <div className="border-t border-border/50 pt-4 flex justify-end">
            <StatefulSaveButton saving={isPending} saved={saved} onSave={handleSave} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
