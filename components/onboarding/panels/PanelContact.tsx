"use client";

/**
 * PanelContact.tsx — Contact, scheduling & notifications preview panel
 *
 * What: Shows three visual previews motivating the user to share their
 *       contact info, availability, and notification preferences:
 *       1. A mock booking confirmation email
 *       2. A mock SMS reminder text bubble
 *       3. A scheduling note about availability
 * Why: Visualizes the benefit of each piece of info the user provides —
 *      confirmations, reminders, and flexible scheduling.
 *
 * Related files:
 * - components/onboarding/steps/StepContact.tsx — the paired left-side form
 */
import { motion } from "framer-motion";
import { LuCalendarDays, LuClock, LuShieldCheck, LuMessageSquare } from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function PanelContact() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[340px] space-y-4"
      >
        <p className="text-[10px] font-medium text-muted uppercase tracking-widest">
          What you&apos;ll receive
        </p>

        {/* Mock email confirmation */}
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
              className="text-[9px] px-1.5 py-0 bg-accent/8 text-accent border-0"
            >
              Confirmed
            </Badge>
          </div>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-foreground mb-0.5">Your booking is confirmed</p>
            <p className="text-xs text-muted leading-relaxed mb-3">
              Classic Lash Set — Saturday, Mar 15 at 2:00 PM
            </p>
            <div className="space-y-1.5 text-xs text-muted/80">
              <div className="flex items-center gap-2">
                <LuCalendarDays className="w-3.5 h-3.5 text-accent/60" />
                <span>Calendar invite attached</span>
              </div>
              <div className="flex items-center gap-2">
                <LuClock className="w-3.5 h-3.5 text-accent/60" />
                <span>Reminder sent 24 hours before</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mock SMS reminder */}
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
              <div className="rounded-xl rounded-tl-sm bg-surface border border-foreground/5 px-3.5 py-2.5">
                <p className="text-xs text-foreground leading-relaxed">
                  <span className="font-medium">T Creative Studio:</span> Reminder — your lash
                  appointment is tomorrow at 2:00 PM. See you soon! Reply STOP to opt out.
                </p>
              </div>
              <p className="text-[10px] text-muted/50 mt-1 ml-1">SMS · 24 hours before</p>
            </div>
          </div>
        </motion.div>

        {/* Scheduling note */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-accent/5 border border-accent/10"
        >
          <LuCalendarDays className="w-4 h-4 text-accent shrink-0" />
          <p className="text-[11px] text-muted leading-relaxed">
            Your availability helps us suggest times that work for you — less back-and-forth, faster
            booking.
          </p>
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
