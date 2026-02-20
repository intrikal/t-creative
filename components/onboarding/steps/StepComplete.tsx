"use client";

/**
 * StepComplete.tsx — Onboarding completion screen
 *
 * What: The final screen shown after all onboarding steps are done. Displays
 *       a success message with the user's name and provides navigation buttons
 *       to book a session or explore the studio.
 * Why: Provides a clear endpoint to the onboarding flow with a sense of
 *      accomplishment, and guides the user toward their next action.
 * How: Reads the user's first name from the form to personalize the message.
 *      Uses Framer Motion for a celebratory animated checkmark on entry.
 *      Two call-to-action buttons link to /services and / respectively.
 *
 * Key concepts:
 * - No onNext prop: This is the terminal step — there's nowhere to advance.
 *   It only receives `form` (to read the name), not navigation callbacks.
 * - Animated SVG checkmark: Uses Framer Motion's `pathLength` animation to
 *   draw the checkmark stroke progressively, creating a satisfying reveal.
 * - The PanelSummary component (shown on the right) complements this with
 *   a data summary card.
 *
 * Related files:
 * - components/onboarding/OnboardingFlow.tsx — renders this when step >= totalSteps
 * - components/onboarding/PanelSummary.tsx — the paired right panel showing data summary
 */
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import type { OnboardingForm } from "../OnboardingFlow";

// interface: TypeScript type contract — StepProps must have a `form` property.
interface StepProps {
  form: OnboardingForm;
}

export function StepComplete({ form }: StepProps) {
  // form.getFieldValue() reads a value from the TanStack Form state.
  const firstName = form.getFieldValue("firstName");

  return (
    <div className="text-center space-y-8">
      {/* Animated checkmark */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mx-auto w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center"
      >
        <motion.svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          {/* motion.path with pathLength: Framer Motion animates the SVG stroke from
              0 (invisible) to 1 (fully drawn), creating a progressive drawing effect. */}
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
        <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-foreground">
          You&apos;re all set{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-muted text-base max-w-sm mx-auto">
          Welcome to T Creative Studio. We&apos;ve saved your preferences — when you&apos;re ready,
          we&apos;re here.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        className="flex flex-col sm:flex-row gap-3 justify-center"
      >
        <Button href="/services" variant="primary">
          Book a Session
        </Button>
        <Button href="/" variant="secondary">
          Explore the Studio
        </Button>
      </motion.div>
    </div>
  );
}
