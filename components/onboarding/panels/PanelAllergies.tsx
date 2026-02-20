"use client";

/**
 * PanelAllergies.tsx — Safety protocol panel for the allergies step
 *
 * What: Displays a card with safety measures (patch tests, hypoallergenic
 *       materials, adapted sessions) to reassure the user.
 * Why: Builds trust while asking about sensitive health information.
 *
 * Related files:
 * - components/onboarding/steps/StepAllergies.tsx — the paired left-side form
 */
import { motion } from "framer-motion";
import { LuShieldCheck, LuTriangleAlert, LuHeart } from "react-icons/lu";
import { Card, CardContent } from "@/components/ui/card";

export function PanelAllergies() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[340px]"
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
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
