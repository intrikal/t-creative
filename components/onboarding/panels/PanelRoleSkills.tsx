"use client";

import { motion } from "framer-motion";
import { LuUser, LuStar } from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const MOCK_SKILLS = ["Lash Extensions", "Permanent Jewelry"];

export function PanelRoleSkills() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[340px] space-y-4"
      >
        <p className="text-[10px] font-medium text-muted uppercase tracking-widest">
          Profile preview
        </p>

        {/* Mock assistant card */}
        <Card className="border-foreground/5 overflow-hidden">
          <CardContent className="p-0">
            <div className="px-5 py-4 flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full bg-accent-geo flex items-center justify-center shrink-0">
                <LuUser className="w-5 h-5 text-accent" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Your Name</p>
                <p className="text-xs text-muted">Lash Tech</p>
              </div>
              <div className="ml-auto flex items-center gap-0.5 text-accent/70">
                {[1, 2, 3, 4, 5].map((i) => (
                  <LuStar
                    key={i}
                    className={`w-3 h-3 ${i <= 4 ? "fill-accent/30 text-accent/70" : "text-foreground/10"}`}
                  />
                ))}
              </div>
            </div>
            <div className="px-5 pb-4">
              <div className="flex flex-wrap gap-1.5">
                {MOCK_SKILLS.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="text-[11px] px-2.5 py-0.5 bg-accent/8 text-accent border-0 font-normal"
                  >
                    {skill}
                  </Badge>
                ))}
                <Badge
                  variant="secondary"
                  className="text-[11px] px-2.5 py-0.5 bg-foreground/5 text-muted border-0 font-normal"
                >
                  + your skills
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How profile is used */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-accent/5 border border-accent/10"
        >
          <LuStar className="w-4 h-4 text-accent shrink-0" />
          <p className="text-[11px] text-muted leading-relaxed">
            Your profile helps clients know what you specialize in and find the right fit.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
