/**
 * Testimonials — Editorial single-quote display with dot navigation. Act VI.
 *
 * One featured review shown at a time. The client name and service sit
 * beneath the quote in small uppercase — the typography hierarchy lets
 * the words do the work, not the chrome.
 *
 * Reviews are pulled from the shared mock data in `lib/data/reviews.ts`.
 * Only reviews with `status === "featured"` appear here. Trini controls
 * which reviews are featured from the admin Reviews dashboard.
 *
 * When the backend is ready, replace the MOCK_REVIEWS import with a server
 * action / DB query that returns the same `Review[]` shape filtered by
 * `status = 'featured'`.
 *
 * Client Component — Framer Motion AnimatePresence cross-fade.
 */
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionWrapper } from "@/components/ui/SectionWrapper";
import { MOCK_REVIEWS } from "@/lib/data/reviews";

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

  if (featuredReviews.length === 0) return null;

  const review = featuredReviews[active];

  return (
    <SectionWrapper id="testimonials" className="py-32 md:py-48 px-6 bg-background">
      <div className="mx-auto max-w-3xl">
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
              {/* Opening mark */}
              <span
                className="font-display text-7xl md:text-9xl text-accent/15 font-light leading-none select-none block -mb-6 md:-mb-10"
                aria-hidden
              >
                &ldquo;
              </span>

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

        {/* Dot navigation */}
        {featuredReviews.length > 1 && (
          <div className="flex items-center justify-center gap-3 mt-14">
            {featuredReviews.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
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
                  className="h-px rounded-full"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </SectionWrapper>
  );
}
