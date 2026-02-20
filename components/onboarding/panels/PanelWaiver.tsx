"use client";

/**
 * PanelWaiver.tsx — Full waiver text panel for the policies step
 *
 * What: Displays the complete service waiver text (Assumption of Risk,
 *       Aftercare, Accuracy, Liability) on the right-side panel so the
 *       user can read it without scrolling the form area.
 * Why: Keeps the left-side form clean (just cancellation highlights +
 *      agreement toggles) while giving the waiver text plenty of space.
 *
 * Related files:
 * - components/onboarding/steps/StepPolicies.tsx — the paired left-side form
 */
import { motion } from "framer-motion";
import { LuClipboardCheck } from "react-icons/lu";

const WAIVER_SECTIONS = [
  {
    title: "Assumption of Risk",
    text: "I understand that beauty and body services — including lash extensions, permanent jewelry welding, and related treatments — carry inherent risks such as skin irritation, allergic reactions, or discomfort. I voluntarily assume these risks.",
  },
  {
    title: "Aftercare Responsibility",
    text: "I agree to follow all aftercare instructions provided by T Creative Studio. I understand that failure to do so may affect results and that T Creative Studio is not liable for complications arising from improper aftercare.",
  },
  {
    title: "Accuracy of Information",
    text: "I confirm that all health and allergy information I have provided is accurate and complete. I will notify T Creative Studio of any changes to my health or sensitivities before future appointments.",
  },
  {
    title: "Release of Liability",
    text: "I release T Creative Studio and its staff from any liability for injury, damage, or adverse reactions that may occur during or after services, except in cases of gross negligence.",
  },
];

export function PanelWaiver() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[380px]"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
            <LuClipboardCheck className="w-4.5 h-4.5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Service Waiver</p>
            <p className="text-[11px] text-muted">Please review before agreeing</p>
          </div>
        </div>

        {/* Waiver sections */}
        <div className="space-y-4">
          {WAIVER_SECTIONS.map((section, i) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.35 }}
            >
              <p className="text-xs font-medium text-foreground uppercase tracking-wider mb-1">
                {section.title}
              </p>
              <p className="text-xs text-muted leading-relaxed">{section.text}</p>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-[11px] text-muted/50 mt-5 text-center"
        >
          Standard for all professional beauty services
        </motion.p>
      </motion.div>
    </div>
  );
}
