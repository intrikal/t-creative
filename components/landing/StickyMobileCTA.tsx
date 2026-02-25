/**
 * StickyMobileCTA — Fixed bottom bar on mobile with booking CTA.
 *
 * Appears after the user scrolls past the Founder section (~30vh).
 * Hides when the user reaches TheInvitation (#booking) to avoid
 * overlapping the final CTA.
 *
 * Only renders on screens < md (768px). Uses Framer Motion for
 * entrance/exit animation.
 *
 * Client Component — uses scroll position + Framer Motion.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

export function StickyMobileCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      const scrollY = window.scrollY;
      const viewportH = window.innerHeight;

      // Show after ~1.5 viewports of scroll
      const showAfter = viewportH * 1.5;

      // Hide when near the #booking section (TheInvitation)
      const bookingEl = document.getElementById("booking");
      const hideAt = bookingEl ? bookingEl.offsetTop - viewportH : document.body.scrollHeight;

      setVisible(scrollY > showAfter && scrollY < hideAt);
    }

    // Only attach on mobile
    if (window.innerWidth >= 768) return;

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-0 inset-x-0 z-50 md:hidden"
        >
          <div className="bg-background/95 backdrop-blur-md border-t border-foreground/8 px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">T Creative Studio</p>
              <p className="text-[10px] text-muted truncate">Lash · Skin · Jewelry · Craft</p>
            </div>
            <Link
              href="/book/tcreativestudio"
              className="shrink-0 px-5 py-2.5 text-[10px] tracking-[0.2em] uppercase bg-foreground text-background hover:bg-foreground/85 transition-colors duration-200"
            >
              Book Now
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
