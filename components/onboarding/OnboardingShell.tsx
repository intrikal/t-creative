"use client";

/**
 * OnboardingShell — the layout wrapper that every onboarding wizard step renders inside.
 *
 * ## Responsibility
 * This component owns the full-screen chrome for the onboarding experience:
 * - The animated progress bar at the top (hidden on the completion screen)
 * - The split layout: right panel (preview) on desktop, top panel on mobile
 * - Animated step transitions (slides up/down based on navigation direction)
 * - A bottom nav bar with previous/next arrow buttons and a "N of total" counter
 * - Auto-scroll-to-top when the active step ID changes
 *
 * ## Why it exists
 * OnboardingFlow.tsx manages state and step logic. OnboardingShell handles
 * presentation only — separating these concerns keeps OnboardingFlow readable
 * and makes it easy to restyle the shell without touching step logic.
 *
 * ## Layout structure
 * ```
 * fixed full-screen container
 * ├── progress bar (absolute, top-0)
 * └── flex row (md+) / flex col (mobile)
 *     ├── panel (right on desktop, top on mobile) — bg-surface, always visible
 *     │   └── AnimatePresence key=stepId — slides in the right panel content
 *     └── form area (left on desktop, below panel on mobile)
 *         ├── overflow-y-auto with scrollRef for scroll reset on step change
 *         ├── AnimatePresence key=stepId — slides step content up or down
 *         └── bottom bar — "N of total" + ↑↓ prev/next arrow buttons
 * ```
 *
 * ## Animation
 * `slideVariants` drives the step transition:
 * - Going forward (direction > 0): new step enters from below, old exits upward
 * - Going backward (direction < 0): new step enters from above, old exits downward
 * The `direction` prop is set by OnboardingFlow and passed down here.
 *
 * ## Props
 * @prop step - 0-based index of the current step
 * @prop totalSteps - total number of steps in the wizard
 * @prop direction - +1 when advancing, -1 when going back (drives slide animation)
 * @prop isComplete - when true, renders completionContent/completionPanel instead of steps
 * @prop stepId - stable string key for the current step (e.g. "name", "contact")
 * @prop stepContent - the form step rendered on the left/bottom
 * @prop panelContent - the info panel rendered on the right/top
 * @prop completionContent - the final "You're all set" content (left/bottom)
 * @prop completionPanel - the final panel (right/top) shown on completion
 * @prop onBack / onNext - step navigation callbacks from OnboardingFlow
 */
import { type ReactNode, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const slideVariants = {
  enter: (d: number) => ({ y: d > 0 ? "40vh" : "-40vh", opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (d: number) => ({ y: d > 0 ? "-40vh" : "40vh", opacity: 0 }),
};

interface OnboardingShellProps {
  step: number;
  totalSteps: number;
  direction: number;
  isComplete: boolean;
  stepId: string | undefined;
  stepContent: ReactNode;
  panelContent: ReactNode;
  completionContent: ReactNode;
  completionPanel: ReactNode;
  onBack: () => void;
  onNext: () => void;
}

export function OnboardingShell({
  step,
  totalSteps,
  direction,
  isComplete,
  stepId,
  stepContent,
  panelContent,
  completionContent,
  completionPanel,
  onBack,
  onNext,
}: OnboardingShellProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [stepId]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background overflow-hidden">
      {/* Progress bar */}
      {!isComplete && (
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-surface z-20">
          <motion.div
            className="h-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Panel — visible on mobile (top) and desktop (right) */}
        <div className="h-[35vh] md:h-auto md:order-2 md:w-[45%] lg:w-1/2 relative bg-surface overflow-y-auto shrink-0 scrollbar-none">
          <div className="flex min-h-full items-center justify-center p-4 md:p-8 lg:p-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={isComplete ? "summary" : stepId}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="w-full h-full"
              >
                {isComplete ? completionPanel : panelContent}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Form content */}
        <div className="relative flex-1 flex flex-col min-w-0 md:order-1">
          {!isComplete && <div className="pt-5" />}

          <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none">
            <div className="flex min-h-full items-center px-6 sm:px-10 md:px-16 lg:px-20 py-4">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={stepId ?? "complete"}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full max-w-lg"
                >
                  {isComplete ? completionContent : stepContent}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Bottom bar */}
          {!isComplete && (
            <div className="flex items-center justify-between px-6 sm:px-10 pb-6">
              <div className="text-xs text-muted/60">
                {step + 1} of {totalSteps}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={onBack}
                  disabled={step === 0}
                  className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                    step === 0
                      ? "text-muted/30 cursor-not-allowed"
                      : "text-muted hover:text-foreground hover:bg-surface"
                  }`}
                  aria-label="Previous step"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3 10l5-5 5 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  onClick={onNext}
                  className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-foreground hover:bg-surface transition-colors"
                  aria-label="Next step"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3 6l5 5 5-5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
