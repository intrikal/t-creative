"use client";

/**
 * PanelAllergies.tsx — Safety protocol panel for the allergies step.
 *
 * What: Two visual sections:
 *       1. A static "Safety Protocol" card listing three studio commitments
 *          (patch tests, hypoallergenic materials, session adaptation).
 *       2. A live "Noted for your file" section that appears via AnimatePresence
 *          as soon as the user makes any selection on the left — showing chosen
 *          allergen badges, a "No known sensitivities" line, and free-text notes.
 *
 * Why: Showing selected allergens back immediately reassures clients that the
 *      information is genuinely captured rather than silently discarded. This
 *      is especially important for allergy data, where trust is high-stakes.
 *      The live reflection also serves as implicit form validation feedback.
 *
 * How: `active` is computed from `Object.entries(ALLERGY_LABELS)` filtered to
 *      keys where the corresponding boolean in `allergies` is true. The "none"
 *      key is excluded from this filter and handled separately via `noneSelected`.
 *      `hasAnyInfo` gates the entire "Noted" section so it stays hidden until
 *      the user has provided at least one signal.
 *
 * @prop allergies - Live allergy object from form.Subscribe; undefined on first render
 *
 * Related files:
 * - components/onboarding/steps/StepAllergies.tsx — the paired left-side form
 * - app/onboarding/actions.ts                     — persists allergies to JSONB
 */
import { motion, AnimatePresence } from "framer-motion";
import { LuShieldCheck, LuTriangleAlert, LuHeart } from "react-icons/lu";
import { Card, CardContent } from "@/components/ui/card";

const ALLERGY_LABELS: Record<string, string> = {
  adhesive: "Adhesive",
  latex: "Latex",
  nickel: "Nickel",
  fragrances: "Fragrances",
};

interface Props {
  allergies?: {
    adhesive: boolean;
    latex: boolean;
    nickel: boolean;
    fragrances: boolean;
    none: boolean;
    notes: string;
  };
}

export function PanelAllergies({ allergies }: Props) {
  const active = allergies
    ? Object.entries(ALLERGY_LABELS).filter(
        ([key]) => (allergies as Record<string, unknown>)[key] === true,
      )
    : [];

  const noneSelected = allergies?.none === true;
  const notes = allergies?.notes?.trim() ?? "";
  const hasAnyInfo = active.length > 0 || noneSelected || notes.length > 0;

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[340px] space-y-4"
      >
        <Card className="border-foreground/5 overflow-hidden">
          <div className="bg-accent/5 px-6 py-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <LuShieldCheck className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Safety Protocol</p>
              <p className="text-xs text-muted">Your comfort is our priority</p>
            </div>
          </div>
          <CardContent className="p-6 space-y-4">
            {[
              { icon: LuTriangleAlert, text: "Complimentary patch tests before every new product" },
              {
                icon: LuShieldCheck,
                text: "Medical-grade, hypoallergenic materials always available",
              },
              { icon: LuHeart, text: "Sessions adapted to your specific sensitivities" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.12, duration: 0.35 }}
                className="flex items-start gap-3"
              >
                <div className="w-6 h-6 rounded-full bg-accent/8 flex items-center justify-center shrink-0 mt-0.5">
                  <item.icon className="w-3 h-3 text-accent" />
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">{item.text}</p>
              </motion.div>
            ))}

            {/* Live sensitivity badges + notes */}
            <AnimatePresence>
              {hasAnyInfo && (
                <motion.div
                  key="noted"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.3 }}
                  className="pt-3 border-t border-foreground/5 space-y-2"
                >
                  <p className="text-[10px] font-medium text-muted uppercase tracking-widest">
                    Noted for your file
                  </p>

                  {/* Allergy badges */}
                  {active.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {active.map(([key, label]) => (
                        <motion.span
                          key={key}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={{ duration: 0.2 }}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-medium"
                        >
                          {label}
                        </motion.span>
                      ))}
                    </div>
                  )}

                  {/* No sensitivities */}
                  {noneSelected && active.length === 0 && (
                    <div className="flex items-center gap-2">
                      <LuShieldCheck className="w-3.5 h-3.5 text-accent/70 shrink-0" />
                      <p className="text-xs text-muted/70">No known sensitivities</p>
                    </div>
                  )}

                  {/* Free-text notes */}
                  {notes.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-start gap-1.5"
                    >
                      <span className="text-muted/40 text-xs mt-0.5 shrink-0">✎</span>
                      <p className="text-xs text-foreground/70 leading-relaxed">{notes}</p>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
