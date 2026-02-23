"use client";

/**
 * StepComplete — the final screen shown to all user roles after onboarding.
 *
 * ## Responsibility
 * Renders a role-specific confirmation screen after the onboarding data has
 * been saved. Handles three roles:
 *
 * ### admin
 * Shows an animated checkmark, the studio's live booking URL (with a copy
 * button), a 2×2 grid of "what's active" feature cards, and a "Complete from
 * your dashboard" footer list. The "Go to Dashboard" button uses a hard
 * navigation (`window.location.href`) rather than `router.push` — this ensures
 * a fresh HTTP request so the AdminLayout's Drizzle-based role check sees the
 * newly saved profile row.
 *
 * ### assistant
 * Minimal screen — "Welcome to the team" message with two dashboard buttons.
 *
 * ### client
 * "Welcome to T Creative Studio" message with Book a Session and Explore CTA buttons.
 *
 * ## Error state
 * If `saveError` is true, an amber error card is shown with a Retry button.
 * While `isSaving` is true, the primary button shows a spinner.
 * Both states disable the primary button via `pointer-events-none` + `opacity-50`.
 *
 * ## Why window.location.href for admin navigation
 * `router.push("/admin")` performs a client-side navigation that may hit a
 * cached or partial response. After onboarding, the session's auth context
 * (and RLS permissions) needs to fully refresh before the AdminLayout reads
 * the profile. A hard navigation forces a full HTTP round-trip, ensuring
 * Next.js runs the middleware and AdminLayout server component fresh.
 *
 * ## Props
 * @prop form - the TanStack Form instance (used only to read `firstName`)
 * @prop role - "client" | "assistant" | "admin" — controls which UI variant renders
 * @prop onBack - optional callback to re-enter the last step (admin only)
 * @prop saveError - set to true if the server action failed
 * @prop isSaving - set to true while the server action is in-flight
 * @prop onRetry - callback to re-attempt the save (shown when saveError is true)
 * @prop studioName - admin studio name used to derive the booking slug
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { LuCopy, LuCheck } from "react-icons/lu";
import { Button } from "@/components/ui/Button";
import type { OnboardingForm } from "../OnboardingFlow";

interface StepProps {
  form: OnboardingForm;
  role?: "client" | "assistant" | "admin";
  onBack?: () => void;
  saveError?: boolean;
  isSaving?: boolean;
  onRetry?: () => void;
  studioName?: string;
}

export function StepComplete({
  form,
  role = "client",
  onBack,
  saveError,
  isSaving,
  onRetry,
  studioName,
}: StepProps) {
  const firstName = form.getFieldValue("firstName");
  const [copied, setCopied] = useState(false);

  const bookingSlug = studioName
    ? studioName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    : "my-studio";
  const bookingUrl = `tcreative.app/book/${bookingSlug}`;

  function copyBookingLink() {
    navigator.clipboard.writeText(`https://${bookingUrl}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="text-center space-y-4">
      {/* Animated checkmark */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mx-auto w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center"
      >
        <motion.svg
          width="24"
          height="24"
          viewBox="0 0 32 32"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <motion.path
            d="M8 16.5L13.5 22L24 11"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          />
        </motion.svg>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="space-y-3"
      >
        <div>
          <h1 className="text-2xl font-light tracking-tight text-foreground">
            You&apos;re all set{firstName ? `, ${firstName}` : ""}
          </h1>
          {role === "admin" && (
            <p className="text-sm text-foreground/50 mt-0.5">
              {studioName ? (
                <>
                  <strong className="text-foreground/70">{studioName}</strong> is live.
                </>
              ) : (
                "Your studio is live."
              )}
            </p>
          )}
        </div>

        {role === "admin" ? (
          <div className="space-y-3 max-w-sm mx-auto text-left">
            {/* Booking link */}
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-accent/8 border border-accent/20">
              <span className="text-sm leading-none shrink-0">🔗</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-accent/70 uppercase tracking-wider leading-none mb-0.5">
                  Booking link
                </p>
                <p className="text-xs font-medium text-foreground truncate">{bookingUrl}</p>
              </div>
              <button
                type="button"
                onClick={copyBookingLink}
                className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:brightness-110 transition-all duration-150"
              >
                {copied ? <LuCheck className="w-3 h-3" /> : <LuCopy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            {/* What's live — 2-col card grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  icon: "📋",
                  label: "Profile & contact",
                  detail: "Booking alerts to your phone & email",
                },
                {
                  icon: "📱",
                  label: "Social links",
                  detail: "One link per bio, straight to booking",
                },
                {
                  icon: "🏠",
                  label: "Studio page",
                  detail: "Name, bio & location visible to clients",
                },
                {
                  icon: "💅",
                  label: "Services & pricing",
                  detail: "Clients see exactly what you offer",
                },
                {
                  icon: "🗓️",
                  label: "Working hours",
                  detail: "Only bookable when you're available",
                },
                {
                  icon: "🤝",
                  label: "Intake & prep",
                  detail: "Sent automatically after each booking",
                },
                {
                  icon: "🛡️",
                  label: "Policies",
                  detail: "Cancellation & no-show fees on autopilot",
                },
                { icon: "🎁", label: "Loyalty program", detail: "Points & tiers on every visit" },
              ].map(({ icon, label, detail }) => (
                <div
                  key={label}
                  className="flex flex-col gap-0.5 px-2.5 py-2 rounded-xl bg-accent/4 border border-accent/10"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm leading-none shrink-0">{icon}</span>
                    <p className="text-xs font-semibold text-foreground leading-tight">{label}</p>
                  </div>
                  <p className="text-[11px] text-muted/55 leading-snug">{detail}</p>
                </div>
              ))}
            </div>

            {/* Coming next */}
            <div>
              <p className="text-[10px] font-semibold text-foreground/30 uppercase tracking-wider mb-1">
                Complete from your dashboard
              </p>
              <div className="flex gap-3">
                {[
                  { icon: "💳", label: "Connect Square" },
                  { icon: "👥", label: "Invite your team" },
                ].map(({ icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 opacity-45">
                    <span className="text-sm leading-none shrink-0">{icon}</span>
                    <p className="text-xs text-foreground/50">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted text-base max-w-sm mx-auto">
            {role === "assistant"
              ? "Welcome to the team! We\u2019ve saved your info \u2014 your schedule will be ready soon."
              : "Welcome to T Creative Studio. We\u2019ve saved your preferences \u2014 when you\u2019re ready, we\u2019re here."}
          </p>
        )}
      </motion.div>

      {saveError && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/20 max-w-sm mx-auto text-left"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-500 leading-tight">
              Couldn&apos;t save your setup
            </p>
            <p className="text-xs text-red-400/70 mt-0.5">Check your connection and try again.</p>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-semibold text-red-500 border border-red-500/30 px-3 py-1.5 rounded-lg hover:bg-red-500/8 transition-colors shrink-0"
            >
              Retry
            </button>
          )}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="flex flex-col sm:flex-row gap-2.5 justify-center"
      >
        {role === "admin" ? (
          <>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md border border-foreground/15 text-foreground/60 hover:text-foreground hover:border-foreground/25 transition-all duration-200 cursor-pointer"
              >
                ← Edit my info
              </button>
            )}
            <Button
              onClick={
                isSaving || saveError
                  ? undefined
                  : () => {
                      window.location.href = "/admin";
                    }
              }
              variant="primary"
              className={isSaving || saveError ? "opacity-50 pointer-events-none" : ""}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving…
                </span>
              ) : (
                "Go to Dashboard"
              )}
            </Button>
          </>
        ) : role === "assistant" ? (
          <>
            <Button href="/assistant" variant="primary">
              View your schedule
            </Button>
            <Button href="/assistant" variant="secondary">
              Go to Dashboard
            </Button>
          </>
        ) : (
          <>
            <Button href="/services" variant="primary">
              Book a Session
            </Button>
            <Button href="/" variant="secondary">
              Explore the Studio
            </Button>
          </>
        )}
      </motion.div>
    </div>
  );
}
