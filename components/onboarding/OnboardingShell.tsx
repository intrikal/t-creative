"use client";

import { type ReactNode } from "react";
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
        <div className="h-[35vh] md:h-auto md:order-2 md:w-[45%] lg:w-1/2 relative bg-surface flex items-center justify-center p-4 md:p-8 lg:p-12 shrink-0">
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

        {/* Form content */}
        <div className="relative flex-1 flex flex-col min-w-0 md:order-1">
          {!isComplete && <div className="pt-5" />}

          <div className="flex-1 flex items-center px-6 sm:px-10 md:px-16 lg:px-20">
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
