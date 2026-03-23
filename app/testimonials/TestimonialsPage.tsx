"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { LuStar } from "react-icons/lu";
import type { FeaturedReview } from "@/lib/public-reviews";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <LuStar
          key={i}
          className={`w-4 h-4 ${i < rating ? "fill-[#d4a574] text-[#d4a574]" : "text-stone-300"}`}
        />
      ))}
    </div>
  );
}

export function TestimonialsPage({
  reviews,
  stats,
}: {
  reviews: FeaturedReview[];
  stats: { count: number; avg: number };
}) {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="pt-32 pb-16 px-6 text-center">
        <m.span
          className="text-[10px] tracking-[0.3em] uppercase text-muted block mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          Testimonials
        </m.span>
        <m.h1
          className="font-display text-4xl md:text-5xl font-light text-foreground mb-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          What Our Clients Say
        </m.h1>
        {stats.count > 0 && (
          <m.div
            className="flex items-center justify-center gap-3 text-sm text-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Stars rating={Math.round(stats.avg)} />
            <span>
              {stats.avg.toFixed(1)} avg from {stats.count} review{stats.count !== 1 ? "s" : ""}
            </span>
          </m.div>
        )}
      </section>

      {/* Reviews grid */}
      <section className="px-6 pb-32 max-w-6xl mx-auto">
        {reviews.length === 0 ? (
          <p className="text-center text-muted text-sm">No reviews yet.</p>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
            {reviews.map((review, i) => (
              <m.article
                key={review.id}
                className="break-inside-avoid mb-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.5) }}
              >
                <div className="flex items-center justify-between mb-3">
                  <Stars rating={review.rating} />
                  <time
                    className="text-[11px] text-muted"
                    dateTime={review.createdAt.split("T")[0]}
                  >
                    {new Date(review.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </time>
                </div>

                {review.body && (
                  <blockquote className="text-sm text-stone-700 leading-relaxed mb-3">
                    &ldquo;{review.body}&rdquo;
                  </blockquote>
                )}

                {review.staffResponse && (
                  <div className="mt-3 pl-3 border-l-2 border-[#e8c4b8]">
                    <p className="text-[11px] font-medium text-[#96604a] mb-0.5">Studio Reply</p>
                    <p className="text-xs text-stone-600 leading-relaxed">{review.staffResponse}</p>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#faf6f1] flex items-center justify-center text-[10px] font-semibold text-[#96604a]">
                    {review.initials}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-stone-900">{review.client}</p>
                    {review.serviceName && (
                      <p className="text-[10px] text-muted">{review.serviceName}</p>
                    )}
                  </div>
                </div>
              </m.article>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="text-center mt-16">
          <p className="text-sm text-muted mb-4">
            Had a great experience? We&apos;d love to hear from you.
          </p>
          <Link
            href="/book/tcreativestudio"
            className="inline-block px-6 py-2.5 rounded-xl bg-[#96604a] text-white text-sm font-medium hover:bg-[#7a4e3a] transition-colors"
          >
            Book Your Next Session
          </Link>
        </div>
      </section>
    </main>
  );
}
