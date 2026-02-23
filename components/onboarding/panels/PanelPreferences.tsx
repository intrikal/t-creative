"use client";

/**
 * PanelPreferences.tsx — Live preview panel for the preferences step.
 *
 * What: Mirrors the user's current selections back to them in real time:
 *       - Availability windows they've toggled on (animated accent pills)
 *       - Notification channel status (on/off badges for Text, Email, Promos)
 *       - Photo consent choice (once made)
 *       Followed by a static "Why we ask" section that explains each category.
 *
 * Why: Immediate visual feedback makes the step feel interactive rather than
 *      form-like. Seeing their choices reflected on the right builds confidence
 *      that the data is being captured correctly and reduces re-checking.
 *
 * How: Props are fed from `form.Subscribe` in OnboardingFlow.tsx, so this
 *      component re-renders only when `availability`, `notifications`, or
 *      `photoConsent` change — not on every keystroke across the whole form.
 *      `AnimatePresence mode="popLayout"` handles smooth pill add/remove.
 *
 * @prop availability  - Object of five boolean availability windows
 * @prop notifications - Object with sms / email / marketing booleans
 * @prop photoConsent  - "" | "yes" | "no"; empty string = not yet chosen
 *
 * Related files:
 * - components/onboarding/steps/StepPreferences.tsx — the paired left-side form
 * - components/onboarding/OnboardingFlow.tsx         — wires the Subscribe → props
 */
import { motion, AnimatePresence } from "framer-motion";
import { LuCalendarDays, LuBell, LuCamera, LuSparkles } from "react-icons/lu";
import { fadeUp, stagger } from "./shared";

const AVAIL_LABELS: Record<string, string> = {
  weekdays: "Weekdays",
  weekends: "Weekends",
  mornings: "Mornings",
  afternoons: "Afternoons",
  evenings: "Evenings",
};

const NOTIF_LABELS: Record<string, string> = {
  sms: "Text",
  email: "Email",
  marketing: "Promos",
};

interface Props {
  availability?: {
    weekdays: boolean;
    weekends: boolean;
    mornings: boolean;
    afternoons: boolean;
    evenings: boolean;
  };
  notifications?: { sms: boolean; email: boolean; marketing: boolean };
  photoConsent?: string;
}

export function PanelPreferences({ availability, notifications, photoConsent }: Props) {
  const selectedAvail = availability
    ? (Object.entries(AVAIL_LABELS).filter(
        ([key]) => (availability as Record<string, boolean>)[key],
      ) as [string, string][])
    : [];

  const notifEntries = notifications ? (Object.entries(NOTIF_LABELS) as [string, string][]) : [];

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[340px] space-y-5"
      >
        {/* Live availability */}
        <div>
          <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-2.5">
            Your schedule
          </p>
          <div className="flex flex-wrap gap-1.5 min-h-[28px]">
            <AnimatePresence mode="popLayout">
              {selectedAvail.length > 0 ? (
                selectedAvail.map(([key, label]) => (
                  <motion.span
                    key={key}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.2 }}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-accent/30 bg-accent/8 text-accent font-medium"
                  >
                    {label}
                  </motion.span>
                ))
              ) : (
                <motion.span
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-[11px] text-muted/35 italic"
                >
                  No windows selected yet
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Live notifications */}
        {notifications && (
          <div>
            <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-2.5">
              Notifications
            </p>
            <div className="flex gap-2">
              {notifEntries.map(([key, label]) => {
                const on = (notifications as Record<string, boolean>)[key];
                return (
                  <motion.div
                    key={key}
                    layout
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors duration-200 ${
                      on
                        ? "border-accent/30 bg-accent/8 text-accent"
                        : "border-foreground/8 bg-foreground/3 text-muted/40"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-200 ${on ? "bg-accent" : "bg-foreground/20"}`}
                    />
                    {label}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Photo consent */}
        {photoConsent && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-2.5">
              Portfolio
            </p>
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors duration-200 ${
                photoConsent === "yes"
                  ? "border-accent/30 bg-accent/8 text-accent"
                  : "border-foreground/10 bg-foreground/4 text-muted"
              }`}
            >
              <LuCamera className="w-3 h-3 shrink-0" />
              {photoConsent === "yes" ? "Yes — feature my results" : "No thanks"}
            </div>
          </motion.div>
        )}

        {/* Divider */}
        <div className="border-t border-foreground/5" />

        {/* Why we ask */}
        <p className="text-[10px] font-medium text-muted uppercase tracking-widest">Why we ask</p>

        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
          <motion.div variants={fadeUp} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/8 flex items-center justify-center shrink-0 mt-0.5">
              <LuCalendarDays className="w-3.5 h-3.5 text-accent" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">Scheduling</p>
              <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                We&apos;ll suggest times that fit your schedule — no back-and-forth.
              </p>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/8 flex items-center justify-center shrink-0 mt-0.5">
              <LuBell className="w-3.5 h-3.5 text-accent" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">Reminders</p>
              <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                Confirmations and 24-hour reminders so you&apos;re never caught off guard.
              </p>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/8 flex items-center justify-center shrink-0 mt-0.5">
              <LuCamera className="w-3.5 h-3.5 text-accent" />
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">Portfolio</p>
              <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                Your results could inspire someone else. You can change this anytime in settings.
              </p>
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="rounded-xl border border-accent/15 bg-accent/5 px-4 py-3 flex items-start gap-3"
        >
          <LuSparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted leading-relaxed">
            Most clients love seeing their work on our Instagram — it&apos;s free marketing for the
            looks they&apos;re proud of.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
