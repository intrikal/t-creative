"use client";

import { motion } from "framer-motion";
import { LuCamera, LuLock, LuSparkles, LuBanknote } from "react-icons/lu";
import { Card, CardContent } from "@/components/ui/card";

const POLICY_DETAILS = [
  {
    icon: LuCamera,
    letter: "A",
    label: "Client photo consent",
    detail:
      "Always get written consent before posting a client's face or identifiable features. Work-only shots (hands, lashes close-up) are generally fine.",
  },
  {
    icon: LuLock,
    letter: "B",
    label: "Confidentiality",
    detail:
      "Client names, contact info, appointment details, and personal conversations stay private. Don't share even casually.",
  },
  {
    icon: LuSparkles,
    letter: "C",
    label: "Studio conduct",
    detail:
      "Represent T Creative on social media as you would in the studio — professionally and positively. Avoid public complaints about clients or colleagues.",
  },
  {
    icon: LuBanknote,
    letter: "D",
    label: "Compensation",
    detail:
      "Your pay structure (commission %, training rates, etc.) was shared separately. This confirms you've received and understood those terms.",
  },
];

export function PanelAssistantPolicies() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[340px] space-y-4"
      >
        <p className="text-[10px] font-medium text-muted uppercase tracking-widest">
          What each agreement means
        </p>

        <Card className="border-foreground/5 overflow-hidden">
          <CardContent className="p-0">
            {POLICY_DETAILS.map((policy, i) => {
              const Icon = policy.icon;
              return (
                <motion.div
                  key={policy.letter}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.1, duration: 0.35 }}
                  className={`flex items-start gap-3 px-5 py-3.5 ${i < POLICY_DETAILS.length - 1 ? "border-b border-foreground/5" : ""}`}
                >
                  <div className="w-7 h-7 rounded-lg bg-accent/8 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-muted uppercase tracking-widest mb-0.5">
                      {policy.label}
                    </p>
                    <p className="text-[11px] text-muted leading-relaxed">{policy.detail}</p>
                  </div>
                </motion.div>
              );
            })}
          </CardContent>
        </Card>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-accent/5 border border-accent/10"
        >
          <LuLock className="w-4 h-4 text-accent shrink-0" />
          <p className="text-[11px] text-muted leading-relaxed">
            These exist to protect you, your clients, and the studio — not to restrict you.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
