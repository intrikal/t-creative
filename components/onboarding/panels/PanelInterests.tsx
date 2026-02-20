"use client";

/**
 * PanelInterests.tsx — Service showcase panel for the interests step
 *
 * What: Displays visual cards for each T Creative service (lash extensions,
 *       permanent jewelry, custom crochet, business consulting).
 * Why: Gives the user context about what each service entails while they
 *      make their selection.
 *
 * Related files:
 * - components/onboarding/steps/StepInterests.tsx — the paired left-side form
 */
// `IconType` is a TypeScript type from react-icons that represents any React icon component.
// The `type` keyword means we're importing only the type (not actual code) — used for type-checking only.
import { motion } from "framer-motion";
import { type IconType } from "react-icons";
import {
  PiEyeClosedBold,
  PiLinkSimpleBold,
  PiCoatHangerBold,
  PiBriefcaseBold,
} from "react-icons/pi";
import { fadeUp, stagger } from "./shared";

export function PanelInterests() {
  // Inline array type: `{ name: string; desc: string; icon: IconType; color: string }[]`
  // describes the shape of each element. The `[]` at the end means "an array of these objects".
  const services: { name: string; desc: string; icon: IconType; color: string }[] = [
    {
      name: "Lash Extensions",
      desc: "Classic, hybrid & volume sets",
      icon: PiEyeClosedBold,
      color: "bg-accent/10",
    },
    {
      name: "Permanent Jewelry",
      desc: "Welded bracelets, anklets & more",
      icon: PiLinkSimpleBold,
      color: "bg-blush/20",
    },
    {
      name: "Custom Crochet",
      desc: "Handmade pieces, made to order",
      icon: PiCoatHangerBold,
      color: "bg-accent/8",
    },
    {
      name: "Business Consulting",
      desc: "Strategy for beauty entrepreneurs",
      icon: PiBriefcaseBold,
      color: "bg-accent/6",
    },
  ];

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
          {services.map((s) => (
            <motion.div key={s.name} variants={fadeUp}>
              <div className="flex items-center gap-4 p-4 rounded-xl border border-foreground/5 bg-background/50">
                {/* Template literal: backticks (`) let you embed variables with `${s.color}`.
                    The value of `s.color` is inserted directly into the string at runtime. */}
                <div
                  className={`w-11 h-11 rounded-lg ${s.color} flex items-center justify-center shrink-0`}
                >
                  {/* <s.icon /> renders the icon component stored in `s.icon` — same pattern as <item.icon /> above. */}
                  <s.icon className="w-5 h-5 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted mt-0.5">{s.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
