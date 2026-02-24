"use client";

/**
 * ProfileSection.tsx — Profile tab for the client settings page.
 *
 * Displays and allows editing of:
 * - Avatar with upload button (Phase 2: uploads to Supabase Storage)
 * - Full name, email, phone
 * - Allergies & notes shared with stylist before each appointment
 *
 * All fields are controlled via local `useState`. Phase 2 will seed
 * initial values from the authenticated user's `profiles` row and
 * persist changes via a server action.
 */

import { useState } from "react";
import { Camera, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * ProfileSection — controlled profile editor with inline save feedback.
 * Self-contained: owns all profile state internally (Phase 2 will lift
 * this to props once wired to the DB).
 */
export function ProfileSection() {
  const [name, setName] = useState("Maya Rodriguez");
  const [email, setEmail] = useState("maya.r@email.com");
  const [phone, setPhone] = useState("(555) 210-4830");
  const [allergies, setAllergies] = useState("No known allergies. Prefer natural curl styles.");
  const [saved, setSaved] = useState(false);

  function saveProfile() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const inputClass =
    "w-full text-sm text-foreground bg-surface border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent/40";

  return (
    <Card className="gap-0">
      <CardContent className="px-5 py-5 space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center">
              <span className="text-xl font-bold text-accent">MR</span>
            </div>
            <button className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center border-2 border-background hover:bg-foreground/80 transition-colors">
              <Camera className="w-3 h-3" />
            </button>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{name}</p>
            <p className="text-xs text-muted mt-0.5">{email}</p>
            <button className="text-xs text-accent hover:underline mt-1">Upload photo</button>
          </div>
        </div>

        {/* Profile fields */}
        <div className="border-t border-border pt-4 space-y-4">
          <p className="text-sm font-semibold text-foreground">Profile Information</p>
          {[
            { label: "Full Name", value: name, onChange: setName, type: "text" },
            { label: "Email", value: email, onChange: setEmail, type: "email" },
            { label: "Phone", value: phone, onChange: setPhone, type: "tel" },
          ].map(({ label, value, onChange, type }) => (
            <div key={label} className="space-y-1.5">
              <label className="text-xs font-medium text-muted">{label}</label>
              <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={inputClass}
              />
            </div>
          ))}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={saveProfile}
              className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
            >
              Save Changes
            </button>
            {saved && (
              <span className="text-xs text-[#4e6b51] font-medium flex items-center gap-1">
                <Check className="w-3 h-3" /> Saved!
              </span>
            )}
          </div>
        </div>

        {/* Allergies & notes */}
        <div className="border-t border-border pt-4">
          <p className="text-xs font-medium text-foreground mb-2">Allergies & Notes</p>
          <textarea
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            rows={3}
            className="w-full text-sm text-foreground bg-surface border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
          <p className="text-[11px] text-muted mt-1.5">
            This info is shared with your stylist before each appointment.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
