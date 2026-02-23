"use client";

/**
 * PanelSummary.tsx — Completion summary card for the client onboarding flow.
 *
 * What: Displays a read-only profile card in the right panel after the client
 *       completes onboarding. Shows: full name, selected services (interest
 *       badges), allergies / sensitivities, contact info (email, phone,
 *       birthday, referrer), availability windows, and notification preferences.
 *
 * Why: Gives the client a final visual confirmation that all their data was
 *      captured correctly before navigating to the dashboard. This is the last
 *      impression of the onboarding experience and should feel polished.
 *
 * How: Reads all values directly from the TanStack Form instance via
 *      `form.getFieldValue()`. No network call — the form is already fully
 *      populated by the time this component renders. Internal IDs are mapped to
 *      human-readable labels via `INTEREST_LABELS`, `ALLERGY_LABELS`, and
 *      `AVAILABILITY_LABELS` dictionaries.
 *
 * TanStack Form dot-notation workaround:
 *       `form.getFieldValue("referral.referrerName" as "referral")` is a type
 *       assertion workaround — TanStack Form's types don't natively accept
 *       nested dot-notation paths, so we assert the path to the parent key
 *       type and then re-assert the result to `string`. The value is correct
 *       at runtime; the assertion is purely to satisfy the TypeScript compiler.
 *
 * This component is client-only because it reads from the form instance
 * (React state) and renders with Framer Motion animations.
 *
 * Related files:
 * - components/onboarding/OnboardingFlow.tsx      — passes the form instance here
 * - components/onboarding/steps/StepComplete.tsx  — the left-side completion content
 * - components/onboarding/OnboardingShell.tsx      — renders both panels side-by-side
 */
import { motion } from "framer-motion";
import {
  LuMail,
  LuPhone,
  LuBell,
  LuHeart,
  LuShieldCheck,
  LuClock,
  LuUsers,
  LuTriangleAlert,
} from "react-icons/lu";
import { TCLogo } from "@/components/TCLogo";
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

const ALLERGY_LABELS: Record<string, string> = {
  adhesive: "Adhesive",
  latex: "Latex",
  nickel: "Nickel",
  fragrances: "Fragrances",
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
  const lastName = form.getFieldValue("lastName") as string | undefined;
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
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
  const allergies = form.getFieldValue("allergies");
  const activeAllergies = Object.entries(allergies)
    .filter(([k, v]) => k !== "none" && k !== "notes" && v === true)
    .map(([k]) => ALLERGY_LABELS[k]);
  const noSensitivities = allergies.none === true;

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
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <TCLogo size={26} className="text-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-medium text-foreground">{fullName || firstName}</p>
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

            {/* ── Allergies / sensitivities ── */}
            {(activeAllergies.length > 0 || noSensitivities) && (
              <div className="px-6 py-4 border-b border-foreground/5">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <LuTriangleAlert className="w-3 h-3 text-muted/60" />
                  <p className="text-[10px] font-medium text-muted uppercase tracking-widest">
                    Sensitivities
                  </p>
                </div>
                {noSensitivities ? (
                  <p className="text-xs text-muted/60">No known sensitivities</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {activeAllergies.map((label) => (
                      <Badge
                        key={label}
                        variant="secondary"
                        className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 border-amber-100 border font-normal"
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

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
