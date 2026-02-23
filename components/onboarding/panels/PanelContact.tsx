"use client";

/**
 * PanelContact.tsx — Live contact preview panel for the contact step.
 *
 * What: Shows two mock communication artifacts side-by-side:
 *       1. A mock booking confirmation email card tagged "Pending approval",
 *          setting the correct expectation that bookings require artist
 *          confirmation before they're finalised.
 *       2. An SMS reminder bubble whose "To:" line updates live as the client
 *          types their phone number on the left-side form.
 *
 * Why: Making the notification experience tangible increases willingness to
 *      share a phone number. The "pending approval" framing also pre-empts
 *      the common confusion of expecting an instant confirmation.
 *
 * How: The `phone` prop arrives from `form.Subscribe` in OnboardingFlow.tsx.
 *      `formatPhone()` converts raw digit strings (stored in the form) to
 *      display-formatted "(555) 123-4567" strings. A `motion.span` with a
 *      unique key on `displayPhone` causes a small slide-in animation each
 *      time the formatted number changes.
 *
 * @prop phone - Raw digit string from form state (not yet formatted)
 *
 * Related files:
 * - components/onboarding/steps/StepContact.tsx — the paired left-side form
 */
import { motion } from "framer-motion";
import { LuCalendarDays, LuClock, LuShieldCheck, LuMessageSquare } from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

function formatPhone(digits: string): string {
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

interface Props {
  phone?: string;
}

export function PanelContact({ phone = "" }: Props) {
  const displayPhone = formatPhone(phone);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[340px] space-y-4"
      >
        <p className="text-[10px] font-medium text-muted uppercase tracking-widest">
          What to expect
        </p>

        {/* Mock booking request email */}
        <Card className="border-foreground/5 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-foreground/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-accent/10 flex items-center justify-center">
                <span className="text-[9px] font-medium text-accent">T</span>
              </div>
              <span className="text-xs font-medium text-foreground">T Creative Studio</span>
            </div>
            <Badge
              variant="secondary"
              className="text-[9px] px-1.5 py-0 bg-foreground/6 text-muted border-0"
            >
              Pending approval
            </Badge>
          </div>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-foreground mb-0.5">Booking request received</p>
            <p className="text-xs text-muted leading-relaxed mb-3">
              Classic Lash Set — Saturday, Mar 15 at 2:00 PM
            </p>
            <div className="space-y-1.5 text-xs text-muted/80">
              <div className="flex items-center gap-2">
                <LuCalendarDays className="w-3.5 h-3.5 text-accent/60" />
                <span>Your artist will confirm within 24 hours</span>
              </div>
              <div className="flex items-center gap-2">
                <LuClock className="w-3.5 h-3.5 text-accent/60" />
                <span>Reminder sent once your booking is approved</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SMS reminder — phone number updates live */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
              <LuMessageSquare className="w-3.5 h-3.5 text-accent" />
            </div>
            <div className="flex-1">
              {/* "To:" line updates as phone is typed */}
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] text-muted/40">To:</span>
                <motion.span
                  key={displayPhone || "placeholder"}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`text-[10px] font-medium ${displayPhone ? "text-accent" : "text-muted/30"}`}
                >
                  {displayPhone || "your phone number"}
                </motion.span>
              </div>
              <div className="rounded-xl rounded-tl-sm bg-surface border border-foreground/5 px-3.5 py-2.5">
                <p className="text-xs text-foreground leading-relaxed">
                  <span className="font-medium">T Creative Studio:</span> Your booking request is
                  confirmed! We&apos;ll send a reminder 24 hours before. Reply STOP to opt out.
                </p>
              </div>
              <p className="text-[10px] text-muted/50 mt-1 ml-1">SMS · sent on approval</p>
            </div>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex items-center gap-1.5 text-[11px] text-muted/60 justify-center"
        >
          <LuShieldCheck className="w-3 h-3" />
          Your info is never shared with third parties
        </motion.p>
      </motion.div>
    </div>
  );
}
