"use client";

import { motion } from "framer-motion";
import { LuMessageSquare, LuMail, LuShieldCheck } from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function PanelContactPrefs() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[340px] space-y-4"
      >
        <p className="text-[10px] font-medium text-muted uppercase tracking-widest">
          What you&apos;ll receive
        </p>

        {/* Mock SMS shift notification */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
              <LuMessageSquare className="w-3.5 h-3.5 text-accent" />
            </div>
            <div className="flex-1">
              <div className="rounded-xl rounded-tl-sm bg-surface border border-foreground/5 px-3.5 py-2.5">
                <p className="text-xs text-foreground leading-relaxed">
                  <span className="font-medium">T Creative Studio:</span> You&apos;re scheduled for
                  tomorrow, Mon 10 AM – 4 PM. See you there!
                </p>
              </div>
              <p className="text-[10px] text-muted/50 mt-1 ml-1">SMS · day before shift</p>
            </div>
          </div>
        </motion.div>

        {/* Mock email schedule update */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card className="border-foreground/5 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-foreground/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-accent/10 flex items-center justify-center">
                  <LuMail className="w-3 h-3 text-accent" />
                </div>
                <span className="text-xs font-medium text-foreground">Schedule Update</span>
              </div>
              <Badge
                variant="secondary"
                className="text-[9px] px-1.5 py-0 bg-accent/8 text-accent border-0"
              >
                New
              </Badge>
            </div>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-foreground mb-0.5">
                Your schedule for next week
              </p>
              <p className="text-xs text-muted leading-relaxed">
                Mon 10–4, Wed 11–5, Fri 9–3. Tap to view details or request changes.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Note */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-accent/5 border border-accent/10"
        >
          <LuMessageSquare className="w-4 h-4 text-accent shrink-0" />
          <p className="text-[11px] text-muted leading-relaxed">
            Choose what works for you — you can update your preferences anytime.
          </p>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex items-center gap-1.5 text-[11px] text-muted/60 justify-center"
        >
          <LuShieldCheck className="w-3 h-3" />
          Your info is never shared with third parties
        </motion.p>
      </motion.div>
    </div>
  );
}
