"use client";

/**
 * PanelPhotoConsent.tsx — Combined panel for the "Almost done" step
 *
 * What: Shows three compact visual previews matching the three sections
 *       on the left side: referral reward, Instagram portfolio mock,
 *       and birthday discount coupon.
 * Why: Each visual motivates the user to engage with its paired section —
 *      referral reward encourages sharing, the portfolio shows where photos
 *      appear, and the coupon motivates sharing a birthday.
 *
 * Related files:
 * - components/onboarding/steps/StepFinalPrefs.tsx — the paired left-side form
 */
import { motion } from "framer-motion";
import { LuCamera, LuImage, LuSparkles, LuUsers, LuGift } from "react-icons/lu";

export function PanelPhotoConsent() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[320px] space-y-5"
      >
        {/* ── Referral reward card ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="rounded-xl border border-accent/15 bg-accent/5 px-4 py-3.5 flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
            <LuUsers className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">Refer a friend</p>
            <p className="text-[11px] text-muted leading-relaxed">
              You both get <span className="font-medium text-accent">15% off</span> your next
              service
            </p>
          </div>
        </motion.div>

        {/* ── Instagram portfolio mock ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
        >
          <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-2">
            Our portfolio
          </p>
          <div className="rounded-xl border border-foreground/5 bg-background/50 overflow-hidden">
            {/* Profile header */}
            <div className="px-3 py-2 flex items-center gap-2.5 border-b border-foreground/5">
              <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
                <span className="text-[9px] font-medium text-accent">T</span>
              </div>
              <div>
                <p className="text-[11px] font-medium text-foreground">tcreativestudio</p>
                <p className="text-[9px] text-muted">San Jose, CA</p>
              </div>
            </div>

            {/* Photo grid — compact 3x2 */}
            <div className="grid grid-cols-3 gap-[2px] p-[2px]">
              {Array.from({ length: 6 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35 + i * 0.04, duration: 0.25 }}
                  className="aspect-square bg-accent/5 flex items-center justify-center"
                >
                  {i % 3 === 0 && <LuCamera className="w-3 h-3 text-accent/30" />}
                  {i % 3 === 1 && <LuImage className="w-3 h-3 text-accent/30" />}
                  {i % 3 === 2 && <LuSparkles className="w-3 h-3 text-accent/30" />}
                </motion.div>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-muted/50 mt-1.5 text-center">
            Your look could inspire someone else&apos;s next appointment
          </p>
        </motion.div>

        {/* ── Birthday coupon ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="rounded-xl border border-accent/15 overflow-hidden"
        >
          <div className="h-1 bg-accent/20" />
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent/8 flex items-center justify-center shrink-0">
              <LuGift className="w-4 h-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground">Birthday treat</p>
              <p className="text-[11px] text-muted">
                <span className="font-medium text-accent">20% off</span> any service during your
                birthday month
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
