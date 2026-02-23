"use client";

/**
 * PanelEmergencyContact — right-panel live preview for StepEmergencyContact (step 4).
 *
 * ## What it shows
 * A live contact card that updates as the user fills in the emergency contact's
 * name, phone number, and relationship. The static "Safety First" header and
 * privacy note remain visible at all times for context.
 *
 * ## Layout
 * - Shield icon · "Safety First" heading (always visible)
 * - Live contact card: shows initials avatar, name, phone, and relationship
 *   as soon as each field has a value; placeholder dashes until filled
 * - Privacy note (always visible)
 *
 * ## Props
 * @prop name         — from form field "emergencyContactName"
 * @prop phone        — from form field "emergencyContactPhone" (raw digits)
 * @prop relationship — from form field "emergencyContactRelation"
 */
import { motion } from "framer-motion";
import { LuShieldCheck, LuLock, LuPhone } from "react-icons/lu";
import { Card, CardContent } from "@/components/ui/card";

function formatPhone(digits: string): string {
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

interface PanelEmergencyContactProps {
  name?: string;
  phone?: string;
  relationship?: string;
}

export function PanelEmergencyContact({ name, phone, relationship }: PanelEmergencyContactProps) {
  const hasName = name && name.trim().length > 0;
  const hasPhone = phone && phone.length > 0;
  const hasRelationship = relationship && relationship.trim().length > 0;
  const hasAny = hasName || hasPhone || hasRelationship;

  const initials = hasName
    ? name
        .trim()
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[340px] space-y-4"
      >
        {/* Shield icon with heading */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-accent/8 flex items-center justify-center"
          >
            <LuShieldCheck className="w-7 h-7 text-accent" />
          </motion.div>
          <h2 className="text-lg font-medium text-foreground mb-1">Safety First</h2>
          <p className="text-sm text-muted leading-relaxed">
            Just in case — we keep this on file for emergencies.
          </p>
        </div>

        {/* Live contact card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card className="border-foreground/5 overflow-hidden">
            <CardContent className="p-4 flex items-center gap-3.5">
              {/* Initials avatar */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold transition-colors duration-200
                  ${hasName ? "bg-accent/15 text-accent" : "bg-foreground/6 text-muted/40"}`}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                {/* Name row */}
                <p
                  className={`text-sm font-medium leading-snug transition-colors duration-200
                    ${hasName ? "text-foreground" : "text-muted/30"}`}
                >
                  {hasName ? name.trim() : "Contact name"}
                </p>

                {/* Phone row */}
                <div className="flex items-center gap-1 mt-0.5">
                  <LuPhone
                    className={`w-3 h-3 shrink-0 ${hasPhone ? "text-muted/60" : "text-muted/20"}`}
                  />
                  <p
                    className={`text-xs transition-colors duration-200
                      ${hasPhone ? "text-muted" : "text-muted/25"}`}
                  >
                    {hasPhone ? formatPhone(phone) : "(555) 123-4567"}
                  </p>
                </div>

                {/* Relationship */}
                {hasRelationship && (
                  <motion.span
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-foreground/6 text-muted/70"
                  >
                    {relationship.trim()}
                  </motion.span>
                )}
              </div>

              {/* Filled indicator */}
              {hasAny && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-1.5 h-1.5 rounded-full bg-accent/60 shrink-0"
                />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Privacy note */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-accent/5 border border-accent/10"
        >
          <LuLock className="w-4 h-4 text-accent shrink-0" />
          <p className="text-[11px] text-muted leading-relaxed">
            Stored securely — only visible to studio admin.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
