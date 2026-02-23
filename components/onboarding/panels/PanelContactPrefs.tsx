"use client";

/**
 * PanelContactPrefs — right-side preview panel for StepContactPrefs.
 *
 * ## What it shows
 * A live contact card that reflects the assistant's contact info and notification
 * preferences as they type on the left side. Updates in real time via
 * `form.Subscribe` in OnboardingFlow.
 *
 * ### Contact card
 * Rows appear dynamically — an email row appears only once `email` is non-empty,
 * a phone row once `phone` is filled, and an Instagram row once `instagramHandle`
 * is filled. While all three are empty the card shows a "Fill in your contact
 * info →" placeholder so the panel is never blank.
 *
 * ### Notification badges
 * The bottom of the card shows accent-colored badges for each active notification
 * channel (SMS / Email / Promos). Badges only appear when the corresponding toggle
 * is enabled, so turning off a channel removes its badge immediately.
 *
 * ## Props
 * All props are optional with safe defaults — the panel renders gracefully before
 * any data has been entered.
 *
 * @prop email            — live email value from the form
 * @prop phone            — live phone value (optional field)
 * @prop instagramHandle  — personal Instagram handle, without the "@"
 * @prop notifications    — object with sms / email / marketing booleans
 */
import { motion } from "framer-motion";
import { LuMail, LuPhone, LuInstagram, LuBell, LuShieldCheck } from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fadeUp, stagger } from "./shared";

interface PanelContactPrefsProps {
  email?: string;
  phone?: string;
  instagramHandle?: string;
  notifications?: { sms: boolean; email: boolean; marketing: boolean };
}

export function PanelContactPrefs({
  email = "",
  phone = "",
  instagramHandle = "",
  notifications = { sms: true, email: true, marketing: false },
}: PanelContactPrefsProps) {
  const activeNotifs = [
    notifications.sms && "SMS",
    notifications.email && "Email",
    notifications.marketing && "Promos",
  ].filter(Boolean) as string[];

  const hasContact = !!(email || phone || instagramHandle);

  return (
    <div className="flex flex-col justify-center h-full px-6">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="w-full max-w-[340px] space-y-4"
      >
        {/* Header */}
        <motion.div variants={fadeUp}>
          <p className="text-[11px] font-semibold text-accent uppercase tracking-[0.15em] mb-0.5">
            Contact & notifications
          </p>
          <h2 className="text-lg font-semibold text-foreground leading-tight">How we reach you.</h2>
          <p className="text-sm text-muted/60 mt-0.5 leading-snug">
            For shift updates, scheduling, and studio news.
          </p>
        </motion.div>

        {/* Live contact card */}
        <motion.div variants={fadeUp}>
          <Card className="border-foreground/8 overflow-hidden">
            <CardContent className="p-0">
              {hasContact ? (
                <>
                  {email && (
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-foreground/6">
                      <LuMail className="w-3.5 h-3.5 text-muted/50 shrink-0" />
                      <span className="text-sm text-foreground/80 truncate">{email}</span>
                    </div>
                  )}
                  {phone && (
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-foreground/6">
                      <LuPhone className="w-3.5 h-3.5 text-muted/50 shrink-0" />
                      <span className="text-sm text-foreground/80">{phone}</span>
                    </div>
                  )}
                  {instagramHandle && (
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-foreground/6">
                      <LuInstagram className="w-3.5 h-3.5 text-muted/50 shrink-0" />
                      <span className="text-sm text-foreground/80">@{instagramHandle}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="px-4 py-4">
                  <p className="text-xs text-muted/40 italic">
                    Fill in your contact info on the left →
                  </p>
                </div>
              )}

              {/* Notification badges */}
              {activeNotifs.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-3">
                  <LuBell className="w-3.5 h-3.5 text-muted/50 shrink-0" />
                  <div className="flex flex-wrap gap-1">
                    {activeNotifs.map((n) => (
                      <Badge
                        key={n}
                        variant="secondary"
                        className="text-[11px] px-2 py-0.5 bg-accent/8 text-accent border-0 font-normal"
                      >
                        {n}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Privacy note */}
        <motion.p
          variants={fadeUp}
          className="flex items-center gap-1.5 text-[11px] text-muted/60 justify-center"
        >
          <LuShieldCheck className="w-3 h-3" />
          Your info is never shared with third parties
        </motion.p>
      </motion.div>
    </div>
  );
}
