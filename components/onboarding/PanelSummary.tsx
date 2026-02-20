"use client";

/**
 * PanelSummary.tsx — Completion summary card shown after onboarding finishes
 *
 * What: Displays a read-only card summarizing everything the user entered
 *       during onboarding — name, services, contact info, availability,
 *       notifications, referral, and birthday.
 * Why: Gives the user a visual confirmation that their data was captured
 *      correctly. Appears in the right-side panel on the completion screen.
 * How: Reads values directly from the TanStack Form instance (passed as a
 *      prop) and maps internal IDs (like "lash") to human-readable labels
 *      (like "Lash Extensions") using lookup dictionaries.
 *
 * Key concepts:
 * - This component does NOT submit data — it only reads and displays.
 * - Object.entries() is used to convert { weekdays: true, weekends: false }
 *   into an array so we can filter for only the `true` values.
 * - The form field path "referral.referrerName" uses dot notation to access
 *   a nested property inside the referral object.
 *
 * Related files:
 * - components/onboarding/OnboardingFlow.tsx — renders this on completion
 * - components/onboarding/steps/StepComplete.tsx — the left-side completion view
 */
import { motion } from "framer-motion";
import {
  LuUser,
  LuMail,
  LuPhone,
  LuBell,
  LuHeart,
  LuShieldCheck,
  LuClock,
  LuUsers,
} from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { OnboardingForm } from "./OnboardingFlow";

// `Record<string, string>` is a TypeScript utility type — it means an object where
// both the keys and the values are strings. Like { "lash": "Lash Extensions", ... }.
const INTEREST_LABELS: Record<string, string> = {
  lash: "Lash Extensions",
  jewelry: "Permanent Jewelry",
  crochet: "Custom Crochet",
  consulting: "Business Consulting",
};

const AVAILABILITY_LABELS: Record<string, string> = {
  weekdays: "Weekdays",
  weekends: "Weekends",
  mornings: "Mornings",
  afternoons: "Afternoons",
  evenings: "Evenings",
};

// `interface Props` defines the expected properties for this React component.
// Any component that renders <PanelSummary /> must pass a `form` prop of type OnboardingForm.
interface Props {
  form: OnboardingForm;
}

export function PanelSummary({ form }: Props) {
  const firstName = form.getFieldValue("firstName");
  const interests = form.getFieldValue("interests");
  const email = form.getFieldValue("email");
  const phone = form.getFieldValue("phone");
  const availability = form.getFieldValue("availability");
  const notifications = form.getFieldValue("notifications");
  // Chained type assertions: `as "referral"` tricks TypeScript into accepting the nested dot-notation
  // path, then `as unknown as string` converts the result to a plain string. This is a workaround
  // because TanStack Form's types don't natively support dot-notation field paths like "referral.referrerName".
  const referralName = form.getFieldValue(
    "referral.referrerName" as "referral",
  ) as unknown as string;
  const birthday = form.getFieldValue("birthday");

  // `Object.entries()` converts { weekdays: true, weekends: false } into
  // [["weekdays", true], ["weekends", false]] — an array of [key, value] pairs.
  const activeAvailability = Object.entries(availability)
    // `.filter(([, v]) => v)`: destructuring in filter — the comma skips the key, `v` is the value.
    // Only keeps entries where the value is truthy (i.e., `true`).
    .filter(([, v]) => v)
    // `.map(([k]) => ...)`: destructuring in map — only extracts the key to look up its label.
    .map(([k]) => AVAILABILITY_LABELS[k]);

  const activeNotifications = Object.entries(notifications)
    .filter(([, v]) => v)
    .map(([k]) => (k === "sms" ? "SMS" : k === "email" ? "Email" : "Promos"));

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[380px]"
      >
        <Card className="border-foreground/5 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {/* ── Header: avatar + name ── */}
            <div className="bg-accent/5 px-6 py-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent-geo flex items-center justify-center shrink-0">
                <LuUser className="w-5 h-5 text-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-medium text-foreground">{firstName}</p>
                <p className="text-xs text-muted">New client</p>
              </div>
            </div>

            {/* ── Services ── */}
            <div className="px-6 py-4 border-b border-foreground/5">
              <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-2.5">
                Services
              </p>
              <div className="flex flex-wrap gap-1.5">
                {interests.map((id) => (
                  <Badge
                    key={id}
                    variant="secondary"
                    className="text-xs px-2.5 py-1 bg-accent/8 text-accent border-0 font-normal"
                  >
                    {INTEREST_LABELS[id]}
                  </Badge>
                ))}
              </div>
            </div>

            {/* ── Contact details ── */}
            <div className="px-6 py-4 border-b border-foreground/5 space-y-2.5">
              <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-2.5">
                Contact
              </p>
              <div className="flex items-center gap-3">
                <LuMail className="w-3.5 h-3.5 text-muted/60 shrink-0" />
                <span className="text-sm text-foreground truncate">{email}</span>
              </div>
              {phone && (
                <div className="flex items-center gap-3">
                  <LuPhone className="w-3.5 h-3.5 text-muted/60 shrink-0" />
                  <span className="text-sm text-foreground">{phone}</span>
                </div>
              )}
              {birthday && (
                <div className="flex items-center gap-3">
                  <LuHeart className="w-3.5 h-3.5 text-muted/60 shrink-0" />
                  <span className="text-sm text-foreground">{birthday}</span>
                </div>
              )}
              {referralName && (
                <div className="flex items-center gap-3">
                  <LuUsers className="w-3.5 h-3.5 text-muted/60 shrink-0" />
                  <span className="text-sm text-foreground">Referred by {referralName}</span>
                </div>
              )}
            </div>

            {/* ── Preferences row ── */}
            <div className="px-6 py-4 grid grid-cols-2 gap-4">
              {/* Availability */}
              {activeAvailability.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <LuClock className="w-3 h-3 text-muted/60" />
                    <p className="text-[10px] font-medium text-muted uppercase tracking-widest">
                      Availability
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {activeAvailability.map((label) => (
                      <Badge
                        key={label}
                        variant="secondary"
                        className="text-[11px] px-2 py-0.5 bg-surface text-foreground/80 border-0 font-normal"
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Notifications */}
              {activeNotifications.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <LuBell className="w-3 h-3 text-muted/60" />
                    <p className="text-[10px] font-medium text-muted uppercase tracking-widest">
                      Notifications
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {activeNotifications.map((label) => (
                      <Badge
                        key={label}
                        variant="secondary"
                        className="text-[11px] px-2 py-0.5 bg-surface text-foreground/80 border-0 font-normal"
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="px-6 py-3 bg-surface/50 flex items-center gap-2">
              <LuShieldCheck className="w-3 h-3 text-muted/50 shrink-0" />
              <p className="text-[10px] text-muted/50">Stored securely by T Creative Studio</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
