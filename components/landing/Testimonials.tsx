/**
 * Testimonials — Editorial single-quote display with dot navigation. Act VI.
 *
 * One featured review shown at a time. The client name and service sit
 * beneath the quote in small uppercase — the typography hierarchy lets
 * the words do the work, not the chrome.
 *
 * Features:
 * - Auto-advance every 6 seconds (pauses on hover/focus)
 * - Progress bar under dots fills over the interval
 * - Parallax quote mark drifts at 0.5x scroll speed
 *
 * Reviews are pulled from the shared mock data in `lib/data/reviews.ts`.
 * Only reviews with `status === "featured"` appear here.
 *
 * Client Component — Framer Motion AnimatePresence cross-fade.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { SectionWrapper } from "@/components/ui/SectionWrapper";
import { MOCK_REVIEWS } from "@/lib/data/reviews";

const AUTO_ADVANCE_MS = 6000;

const serviceLabel: Record<string, string> = {
  lash: "Lash",
  jewelry: "Jewelry",
  crochet: "Crochet",
  consulting: "Consulting",
  training: "Training",
};

// TODO: replace with DB query — fetch reviews where status = 'featured'
const featuredReviews = MOCK_REVIEWS.filter((r) => r.status === "featured");

export function Testimonials() {
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  // Parallax quote mark — drifts at 0.5x scroll speed
  const quoteY = useTransform(scrollYProgress, [0, 1], ["0px", "-40px"]);

  const advance = useCallback(() => {
    setActive((prev) => (prev + 1) % featuredReviews.length);
    setProgress(0);
  }, []);

  // Auto-advance timer
  useEffect(() => {
    if (isPaused || featuredReviews.length <= 1) return;

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(elapsed / AUTO_ADVANCE_MS, 1);
      setProgress(pct);
      if (pct >= 1) {
        advance();
      }
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [active, isPaused, advance]);

  if (featuredReviews.length === 0) return null;

  const review = featuredReviews[active];

  return (
    <SectionWrapper id="testimonials" className="py-32 md:py-48 px-6 bg-background">
      <div
        ref={sectionRef}
        className="mx-auto max-w-3xl"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        {/* Section label */}
        <motion.span
          className="text-[10px] tracking-[0.3em] uppercase text-muted mb-16 md:mb-24 block text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          What clients say
        </motion.span>

        {/* Single quote with cross-fade */}
        <div className="relative min-h-[200px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="text-center"
            >
              {/* Opening mark — parallax drift */}
              <motion.span
                style={{ y: quoteY }}
                className="font-display text-7xl md:text-9xl text-accent/15 font-light leading-none select-none block -mb-6 md:-mb-10"
                aria-hidden
              >
                &ldquo;
              </motion.span>

              <blockquote className="font-display text-2xl md:text-3xl lg:text-4xl font-light italic text-foreground leading-[1.4] tracking-tight max-w-2xl mx-auto">
                {review.text}
              </blockquote>

              <div className="mt-8 flex flex-col items-center gap-1">
                <p className="text-sm font-medium tracking-wide text-foreground">{review.client}</p>
                <p className="text-[10px] tracking-[0.25em] uppercase text-muted">
                  {serviceLabel[review.service] ?? review.service}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dot navigation with progress indicator */}
        {featuredReviews.length > 1 && (
          <div className="flex flex-col items-center gap-4 mt-14">
            <div className="flex items-center justify-center gap-3">
              {featuredReviews.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setActive(i);
                    setProgress(0);
                  }}
                  aria-label={`Review ${i + 1}`}
                  className="group p-1"
                >
                  <motion.div
                    animate={{
                      width: i === active ? 24 : 6,
                      backgroundColor: i === active ? "#96604a" : "#6b5d52",
                      opacity: i === active ? 1 : 0.35,
                    }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="h-px rounded-full relative overflow-hidden"
                  >
                    {/* Progress fill on active dot */}
                    {i === active && (
                      <motion.div
                        className="absolute inset-y-0 left-0 bg-[#96604a]"
                        style={{ width: `${progress * 100}%` }}
                      />
                    )}
                  </motion.div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionWrapper>
  );
}
