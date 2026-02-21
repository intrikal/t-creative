"use client";

import { motion } from "framer-motion";
import { LuClock, LuUsers } from "react-icons/lu";
import { Card, CardContent } from "@/components/ui/card";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const HIGHLIGHTED = [0, 2, 4]; // Mon, Wed, Fri

export function PanelShiftAvailability() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[340px] space-y-4"
      >
        <p className="text-[10px] font-medium text-muted uppercase tracking-widest">
          Your week at a glance
        </p>

        {/* Mock weekly calendar grid */}
        <Card className="border-foreground/5 overflow-hidden">
          <CardContent className="p-5">
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS.map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-medium text-muted uppercase">{day}</span>
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 + i * 0.05, duration: 0.3 }}
                    className={`
                      w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium
                      ${
                        HIGHLIGHTED.includes(i)
                          ? "bg-accent/15 text-accent border border-accent/20"
                          : "bg-foreground/3 text-muted/40 border border-foreground/5"
                      }
                    `}
                  >
                    {10 + i}
                  </motion.div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Mock next shift card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card className="border-foreground/5 overflow-hidden">
            <CardContent className="p-4 flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <LuClock className="w-4 h-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">Next Shift</p>
                <p className="text-[11px] text-muted">Monday 10:00 AM – 4:00 PM</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Schedule visibility note */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-accent/5 border border-accent/10"
        >
          <LuUsers className="w-4 h-4 text-accent shrink-0" />
          <p className="text-[11px] text-muted leading-relaxed">
            Your schedule will be visible to the team so shifts can be coordinated smoothly.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
