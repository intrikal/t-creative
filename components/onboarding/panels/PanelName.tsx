"use client";

/**
 * PanelName.tsx — Welcome panel shown alongside the name input step
 *
 * What: Displays the T Creative Studio brand mark, tagline, and trust
 *       indicators (Private, Personal, 2 min).
 * Why: Creates a warm first impression and sets expectations for the
 *      onboarding experience.
 *
 * Related files:
 * - components/onboarding/steps/StepName.tsx — the paired left-side form
 */
import { motion } from "framer-motion";
import { LuShieldCheck, LuSparkles, LuClock } from "react-icons/lu";

export function PanelName() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-[360px] text-center"
      >
        {/* Logo mark */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto mb-8 w-20 h-20 rounded-2xl bg-accent/8 flex items-center justify-center"
        >
          <span className="text-3xl font-light text-accent tracking-tight">T</span>
        </motion.div>

        <h2 className="text-xl font-medium text-foreground mb-2">T Creative Studio</h2>
        <p className="text-sm text-muted leading-relaxed mb-8">
          Beauty, craftsmanship, and creativity — all in one place. Let&apos;s personalize your
          experience.
        </p>

        {/* Trust indicators */}
        <div className="flex items-center justify-center gap-6 text-muted">
          {[
            { icon: LuShieldCheck, label: "Private" },
            { icon: LuSparkles, label: "Personal" },
            { icon: LuClock, label: "2 min" },
            // `.map()` loops over the array. `item` is each object, `i` is the index (0, 1, 2...).
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1, duration: 0.3 }}
              className="flex flex-col items-center gap-1.5"
            >
              {/* Rendering a component stored in a variable: React lets you use any
                  capitalized variable holding a component as JSX, like <item.icon />. */}
              <item.icon className="w-4 h-4 text-accent/70" />
              <span className="text-[11px]">{item.label}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
