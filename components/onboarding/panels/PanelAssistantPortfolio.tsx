"use client";

import { motion } from "framer-motion";
import { LuInstagram, LuLink, LuSparkles } from "react-icons/lu";
import { SiTiktok } from "react-icons/si";
import { Card, CardContent } from "@/components/ui/card";

interface PanelAssistantPortfolioProps {
  portfolioInstagram?: string;
  tiktokHandle?: string;
  portfolioWebsite?: string;
}

export function PanelAssistantPortfolio({
  portfolioInstagram,
  tiktokHandle,
  portfolioWebsite,
}: PanelAssistantPortfolioProps) {
  const hasAny = portfolioInstagram?.trim() || tiktokHandle?.trim() || portfolioWebsite?.trim();

  const links = [
    {
      icon: LuInstagram,
      label: "Instagram",
      value: portfolioInstagram?.trim() ? `@${portfolioInstagram.trim()}` : null,
      placeholder: "@yourportfolio",
    },
    {
      icon: SiTiktok,
      label: "TikTok",
      value: tiktokHandle?.trim() ? `@${tiktokHandle.trim()}` : null,
      placeholder: "@yourhandle",
    },
    {
      icon: LuLink,
      label: "Website",
      value: portfolioWebsite?.trim() || null,
      placeholder: "yoursite.com",
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[340px] space-y-4"
      >
        <p className="text-[10px] font-medium text-muted uppercase tracking-widest">
          Your online presence
        </p>

        <Card className="border-foreground/5 overflow-hidden">
          <CardContent className="p-0">
            {links.map((link, i) => {
              const Icon = link.icon;
              const isSet = !!link.value;
              return (
                <motion.div
                  key={link.label}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
                  className={`flex items-center gap-3 px-5 py-3.5 ${i < links.length - 1 ? "border-b border-foreground/5" : ""}`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200 ${
                      isSet ? "bg-accent/12 text-accent" : "bg-foreground/5 text-muted/40"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted/60 uppercase tracking-widest">
                      {link.label}
                    </p>
                    <p
                      className={`text-xs font-medium truncate transition-colors duration-200 ${
                        isSet ? "text-foreground" : "text-muted/30"
                      }`}
                    >
                      {link.value ?? link.placeholder}
                    </p>
                  </div>
                  {isSet && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-1.5 h-1.5 rounded-full bg-accent shrink-0"
                    />
                  )}
                </motion.div>
              );
            })}
          </CardContent>
        </Card>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-accent/5 border border-accent/10"
        >
          <LuSparkles className="w-4 h-4 text-accent shrink-0" />
          <p className="text-[11px] text-muted leading-relaxed">
            {hasAny
              ? "Clients and students will see these when viewing your profile."
              : "Optional — skip if you'd rather not share socials right now."}
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
