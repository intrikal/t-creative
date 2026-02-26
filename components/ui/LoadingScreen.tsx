/**
 * LoadingScreen — Branded loading state shown while the page initializes.
 *
 * Features the signature horizontal rule growing animation (the brand's
 * visual motif) with "Studio." text beneath. Fades out after a minimum
 * display time or when content is ready.
 *
 * Client Component — uses state for mount/unmount cycle.
 */
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function LoadingScreen() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Minimum display: 1.8s so the animation completes, then check if page is loaded
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="fixed inset-0 z-[10001] bg-[#2c2420] flex flex-col items-center justify-center gap-8"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Growing rule — signature brand motif */}
          <motion.div
            className="h-px bg-[#faf6f1]/30"
            initial={{ width: 0 }}
            animate={{ width: 120 }}
            transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Brand mark */}
          <motion.p
            className="font-display text-lg tracking-[0.15em] text-[#faf6f1]/60 font-light"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            Studio.
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
