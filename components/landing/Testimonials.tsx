/**
 * Testimonials — Full-bleed typographic quote display. Act VI.
 *
 * One review fills 70% of viewport width in editorial serif. Transitions
 * between quotes use a word-by-word stagger — each word fades out in sequence
 * (left to right), then the new quote assembles the same way.
 *
 * Auto-advance every 6 seconds. Pauses on hover/focus.
 *
 * Client Component — Framer Motion AnimatePresence word-stagger.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MOCK_REVIEWS } from "@/lib/data/reviews";

const AUTO_ADVANCE_MS = 6000;

const serviceLabel: Record<string, string> = {
  lash: "Lash",
  jewelry: "Jewelry",
  crochet: "Crochet",
  consulting: "Consulting",
  training: "Training",
};

const featuredReviews = MOCK_REVIEWS.filter((r) => r.status === "featured");

/** Split text into words, preserving spaces for natural flow */
function WordStagger({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className="inline-block mr-[0.3em]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{
            duration: 0.4,
            delay: i * 0.03,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {word}
        </motion.span>
      ))}
    </>
  );
}

export function Testimonials() {
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback(() => {
    setActive((prev) => (prev + 1) % featuredReviews.length);
    setProgress(0);
  }, []);

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
    <section
      id="testimonials"
      className="py-32 md:py-48 px-6 bg-background overflow-hidden"
      aria-label="Client testimonials"
    >
      <div
        className="mx-auto max-w-5xl"
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

        {/* Full-bleed typographic quote */}
        <div className="relative min-h-[280px] md:min-h-[320px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={review.id}
              className="text-center w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <blockquote className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-light italic text-foreground leading-[1.35] tracking-tight max-w-4xl mx-auto mb-10">
                <span className="text-accent/20 font-display text-5xl md:text-6xl not-italic leading-none mr-1">
                  &ldquo;
                </span>
                <WordStagger text={review.text} />
                <span className="text-accent/20 font-display text-5xl md:text-6xl not-italic leading-none ml-1">
                  &rdquo;
                </span>
              </blockquote>

              <motion.div
                className="flex flex-col items-center gap-1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <p className="text-xs tracking-[0.25em] uppercase text-foreground font-medium">
                  {review.client}
                </p>
                <p className="text-[10px] tracking-[0.3em] uppercase text-muted">
                  {serviceLabel[review.service] ?? review.service}
                </p>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dot navigation with progress */}
        {featuredReviews.length > 1 && (
          <div className="flex items-center justify-center gap-3 mt-16">
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
                    width: i === active ? 32 : 6,
                    backgroundColor: i === active ? "#96604a" : "#6b5d52",
                    opacity: i === active ? 1 : 0.3,
                  }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="h-[2px] rounded-full relative overflow-hidden"
                >
                  {i === active && (
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-accent"
                      style={{ width: `${progress * 100}%` }}
                    />
                  )}
                </motion.div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
