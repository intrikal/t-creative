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
import type { FeaturedReview } from "@/lib/public-reviews";

// Auto-advance interval in milliseconds. 6 seconds balances readability with engagement —
// long enough to read a quote, short enough to feel dynamic.
const AUTO_ADVANCE_MS = 6000;

// Maps service slug strings to display labels. Record<string, string> for O(1) lookup.
const serviceLabel: Record<string, string> = {
  lash: "Lash",
  jewelry: "Jewelry",
  crochet: "Crochet",
  consulting: "Consulting",
  training: "Training",
};

/**
 * WordStagger — Splits text into words and animates each with staggered entrance/exit.
 *
 * Props:
 * - text: the review text to split and animate
 *
 * text.split(" ") breaks on spaces to get individual words. Each word is wrapped in a
 * motion.span with staggered delay (i * 0.03) so the quote assembles word-by-word.
 * Split approach chosen over character-by-character for readability and performance.
 */
function WordStagger({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {/* .map() renders each word as an individually animated inline-block span.
          mr-[0.3em] adds natural word spacing since inline-block collapses whitespace. */}
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

/**
 * Testimonials — Full-bleed typographic quote carousel with auto-advance and dot navigation.
 *
 * Props (optional):
 * - reviews: FeaturedReview[] from the database. Falls back to empty array (shows placeholder).
 *
 * Destructuring renames `reviews` to `dbReviews` for clarity inside the component.
 */
export function Testimonials({ reviews: dbReviews }: { reviews?: FeaturedReview[] } = {}) {
  // (dbReviews ?? []).map() transforms DB review objects into the simpler shape needed for display.
  // Nullish coalescing on dbReviews handles undefined prop. .map() transforms each review:
  // - id for AnimatePresence keying
  // - client name for attribution
  // - body with ?? "" fallback for null review text
  // - serviceName with ?? "general" fallback for uncategorized reviews
  const featuredReviews = (dbReviews ?? []).map((r) => ({
    id: r.id,
    client: r.client,
    text: r.body ?? "",
    service: r.serviceName ?? "general",
  }));

  // active: index of the currently displayed review in the featuredReviews array.
  const [active, setActive] = useState(0);
  // isPaused: true when user hovers or focuses the section — halts auto-advance to let them read.
  const [isPaused, setIsPaused] = useState(false);
  // progress: 0→1 fill level of the active dot indicator, driven by the timer interval.
  const [progress, setProgress] = useState(0);
  // timerRef: holds the setInterval ID for cleanup. useRef instead of state because
  // changing the timer ID shouldn't trigger a re-render.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // useCallback memoizes the advance function to keep it referentially stable across renders.
  // This is important because `advance` is a dependency of the useEffect below — without
  // memoization, the effect would re-run on every render.
  // Modulo (%) wraps the index back to 0 after the last review for infinite cycling.
  const advance = useCallback(() => {
    setActive((prev) => (prev + 1) % featuredReviews.length);
    setProgress(0);
  }, [featuredReviews.length]);

  // useEffect manages the auto-advance timer. Cannot run during render because it uses
  // setInterval (side effect) and Date.now() (non-deterministic).
  // Re-runs when: active changes (restart timer for new quote), isPaused toggles,
  // advance reference changes, or review count changes.
  // Early return skips timer setup when paused or when there's only one review.
  // The 50ms interval updates the progress bar smoothly (~20fps visual update).
  // Cleanup clears the interval when deps change or component unmounts.
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
  }, [active, isPaused, advance, featuredReviews.length]);

  // Conditional render: if no reviews are available (empty DB or no featured reviews),
  // show a minimal placeholder section instead of an empty carousel.
  if (featuredReviews.length === 0) {
    return (
      <section id="testimonials" className="py-32 md:py-48 px-6 bg-background">
        <div className="mx-auto max-w-5xl text-center">
          <span className="text-[10px] tracking-[0.3em] uppercase text-muted block">
            What clients say
          </span>
          <p className="text-sm text-muted mt-8">No testimonials yet.</p>
        </div>
      </section>
    );
  }

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
                {/* Nullish coalescing: look up a friendly service label from the serviceLabel map;
                    if no match, fall back to displaying the raw service string. */}
                <p className="text-[10px] tracking-[0.3em] uppercase text-muted">
                  {serviceLabel[review.service] ?? review.service}
                </p>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Conditional render: dot navigation only shows when there are multiple reviews.
            Single-review display doesn't need navigation controls. */}
        {featuredReviews.length > 1 && (
          <div className="flex items-center justify-center gap-3 mt-16">
            {/* .map() renders one dot per review. The active dot expands to 32px width
                and shows a progress fill bar; inactive dots are 6px circles.
                Clicking a dot sets that review as active and resets the progress timer. */}
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
                  {/* Conditional render: progress fill bar only renders on the active dot.
                      Width is driven by the progress state (0→100%) for smooth fill animation. */}
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
