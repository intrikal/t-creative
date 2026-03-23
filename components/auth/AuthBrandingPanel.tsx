"use client";

import { m } from "framer-motion";
import { TCLogo } from "@/components/TCLogo";

export function AuthBrandingPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <m.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-[360px] text-center"
      >
        {/* Logo mark */}
        <m.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto mb-8 w-20 h-20 rounded-2xl bg-accent/8 flex items-center justify-center"
        >
          <TCLogo size={44} className="text-accent" />
        </m.div>

        <h2 className="text-xl font-medium text-foreground mb-2">T Creative Studio</h2>
        <p className="text-sm text-muted leading-relaxed">
          Lash extensions, permanent jewelry, custom crochet &amp; business consulting — all in one
          place.
        </p>
      </m.div>
    </div>
  );
}
