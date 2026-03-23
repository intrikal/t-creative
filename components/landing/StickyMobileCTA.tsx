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
import { AnimatePresence, m } from "framer-motion";
import posthog from "posthog-js";

export function StickyMobileCTA() {
  // visible: controls whether the sticky bar renders. Boolean toggle driven by
  // scroll position — true after 1.5 viewports of scroll, false near the #booking section.
  const [visible, setVisible] = useState(false);

  // useEffect attaches a scroll listener on mobile only (< 768px).
  // Cannot run during render because it accesses window.scrollY and DOM element positions.
  // Passive listener for scroll performance — we only read, never preventDefault.
  // Early return for desktop avoids registering a listener that would never show the bar.
  // Cleanup removes the listener when the component unmounts.
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
    // AnimatePresence enables the exit animation (slide down) when visible becomes false.
    // Conditional render: bar only mounts when scroll position is in the valid range.
    <AnimatePresence>
      {visible && (
        <m.div
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
              onClick={() =>
                posthog.capture("cta_clicked", { cta: "book_now", location: "mobile_sticky" })
              }
              className="shrink-0 px-5 py-2.5 text-[10px] tracking-[0.2em] uppercase bg-foreground text-background hover:bg-foreground/85 transition-colors duration-200"
            >
              Book Now
            </Link>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
