"use client";

import { motion } from "framer-motion";
import { LuShieldCheck, LuLock, LuHeart } from "react-icons/lu";
import { Card, CardContent } from "@/components/ui/card";

export function PanelEmergencyContact() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[340px] space-y-4"
      >
        {/* Shield icon with heading */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-accent/8 flex items-center justify-center"
          >
            <LuShieldCheck className="w-7 h-7 text-accent" />
          </motion.div>
          <h2 className="text-lg font-medium text-foreground mb-1">Safety First</h2>
          <p className="text-sm text-muted leading-relaxed">
            Just in case — we keep this on file for emergencies.
          </p>
        </div>

        {/* "Only used in emergencies" callout */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card className="border-foreground/5 overflow-hidden">
            <CardContent className="p-4 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <LuHeart className="w-4 h-4 text-rose-500/70" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-0.5">
                  Only used in emergencies
                </p>
                <p className="text-xs text-muted leading-relaxed">
                  We&apos;ll only contact this person if something unexpected happens at the studio
                  and we need to reach someone on your behalf.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Privacy note */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-accent/5 border border-accent/10"
        >
          <LuLock className="w-4 h-4 text-accent shrink-0" />
          <p className="text-[11px] text-muted leading-relaxed">
            Stored securely — only visible to studio admin.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
