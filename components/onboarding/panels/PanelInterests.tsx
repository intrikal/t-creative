"use client";

/**
 * PanelInterests.tsx — Service showcase panel for the interests step.
 *
 * What: Four service cards (Lash Extensions, Permanent Jewelry, Custom Crochet,
 *       Business Consulting). When a service is selected on the left-side form,
 *       its card transitions here: accent border, brighter icon background, and
 *       an animated checkmark badge (scale 0→1 via AnimatePresence). Unselected
 *       cards dim to 45% opacity once any selection exists, so chosen cards
 *       stand out visually.
 *
 * Why: The side-by-side layout means the client can see their choices reflected
 *      as a visual set, rather than just a text list. This helps hesitant clients
 *      understand the full service menu before committing to a selection.
 *
 * How: `interests` arrives from `form.Subscribe` in OnboardingFlow.tsx, so only
 *      this panel re-renders when the interests array changes. The opacity
 *      animation uses `motion.div animate={{ opacity }}` (not CSS) so it runs on
 *      the JS thread and stays in sync with other Framer Motion animations.
 *
 * @prop interests - Array of selected service IDs; empty array = nothing selected yet
 *
 * Related files:
 * - components/onboarding/steps/StepInterests.tsx — the paired left-side form
 * - components/onboarding/OnboardingFlow.tsx       — conditionally adds allergies step
 *                                                    based on whether interests includes "lash"/"jewelry"
 */
import { motion, AnimatePresence } from "framer-motion";
import { type IconType } from "react-icons";
import {
  PiEyeClosedBold,
  PiLinkSimpleBold,
  PiCoatHangerBold,
  PiBriefcaseBold,
} from "react-icons/pi";
import { fadeUp, stagger } from "./shared";

type ServiceId = "lash" | "jewelry" | "crochet" | "consulting";

const SERVICES: {
  id: ServiceId;
  name: string;
  desc: string;
  icon: IconType;
  iconBg: string;
  iconBgSelected: string;
}[] = [
  {
    id: "lash",
    name: "Lash Extensions",
    desc: "Classic, hybrid & volume sets",
    icon: PiEyeClosedBold,
    iconBg: "bg-accent/10",
    iconBgSelected: "bg-accent/20",
  },
  {
    id: "jewelry",
    name: "Permanent Jewelry",
    desc: "Welded bracelets, anklets & more",
    icon: PiLinkSimpleBold,
    iconBg: "bg-blush/20",
    iconBgSelected: "bg-blush/35",
  },
  {
    id: "crochet",
    name: "Custom Crochet",
    desc: "Handmade pieces, made to order",
    icon: PiCoatHangerBold,
    iconBg: "bg-accent/8",
    iconBgSelected: "bg-accent/18",
  },
  {
    id: "consulting",
    name: "Business Consulting",
    desc: "Strategy for beauty entrepreneurs",
    icon: PiBriefcaseBold,
    iconBg: "bg-accent/6",
    iconBgSelected: "bg-accent/15",
  },
];

interface Props {
  interests?: ServiceId[];
}

export function PanelInterests({ interests = [] }: Props) {
  const anySelected = interests.length > 0;

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[340px]"
      >
        <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-4">
          What we offer
        </p>

        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-2.5">
          {SERVICES.map((s) => {
            const isSelected = interests.includes(s.id);
            return (
              <motion.div key={s.id} variants={fadeUp}>
                <motion.div
                  animate={{
                    opacity: anySelected && !isSelected ? 0.45 : 1,
                  }}
                  transition={{ duration: 0.2 }}
                  className={`
                    relative flex items-center gap-4 p-4 rounded-xl border transition-colors duration-200
                    ${
                      isSelected
                        ? "border-accent/35 bg-accent/4"
                        : "border-foreground/5 bg-background/50"
                    }
                  `}
                >
                  <div
                    className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200 ${isSelected ? s.iconBgSelected : s.iconBg}`}
                  >
                    <s.icon className="w-5 h-5 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium transition-colors duration-200 ${isSelected ? "text-foreground" : "text-foreground/80"}`}
                    >
                      {s.name}
                    </p>
                    <p className="text-xs text-muted mt-0.5">{s.desc}</p>
                  </div>

                  {/* Animated checkmark — appears when selected */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        key="check"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute top-3 right-3 w-5 h-5 rounded-full bg-accent flex items-center justify-center shrink-0"
                      >
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2.5 6L5 8.5L9.5 3.5"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>
    </div>
  );
}
