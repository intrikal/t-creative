"use client";

/**
 * Testimonials — Firecrawl-style dual-row marquee.
 *
 * Two rows of review cards scroll in opposite directions via CSS animation.
 * Top row scrolls left, bottom row scrolls right. Hovering any row pauses
 * its animation. Each card shows client initial avatar, name, service badge,
 * and quote text.
 *
 * Cards are duplicated (2×) to create a seamless infinite loop.
 */

import type { FeaturedReview } from "@/lib/public-reviews";

const serviceLabel: Record<string, string> = {
  lash: "Lash",
  jewelry: "Jewelry",
  crochet: "Crochet",
  consulting: "Consulting",
  training: "Training",
};

const serviceColor: Record<string, string> = {
  lash: "#C4907A",
  jewelry: "#D4A574",
  crochet: "#7BA3A3",
  consulting: "#5B8A8A",
};

const PLACEHOLDER_REVIEWS = [
  {
    id: "p1",
    client: "A. Chen",
    text: "Absolutely stunning lash set. My eyes have never looked so defined — and they lasted six weeks.",
    service: "lash",
  },
  {
    id: "p2",
    client: "M. Rivera",
    text: "The permanent bracelet is everything. I forget it's even there until someone asks about it. Perfect.",
    service: "jewelry",
  },
  {
    id: "p3",
    client: "D. Williams",
    text: "Trini is an artist. My crochet install turned out better than anything I've seen anywhere else.",
    service: "crochet",
  },
  {
    id: "p4",
    client: "S. Park",
    text: "I walked in nervous and walked out glowing. The whole experience was calm, professional, and beautiful.",
    service: "lash",
  },
  {
    id: "p5",
    client: "J. Torres",
    text: "Best permanent jewelry experience. She took her time getting the fit exactly right before welding.",
    service: "jewelry",
  },
  {
    id: "p6",
    client: "K. Nguyen",
    text: "Worth every penny. The studio is beautiful and Trini made me feel completely at ease.",
    service: "lash",
  },
  {
    id: "p7",
    client: "L. Gomez",
    text: "The business bootcamp changed how I run my salon. Clear systems, real advice, no fluff.",
    service: "consulting",
  },
  {
    id: "p8",
    client: "R. Patel",
    text: "I drove two hours for this appointment and I'd do it again. Nobody else does lashes like this.",
    service: "lash",
  },
];

interface ReviewCard {
  id: string;
  client: string;
  text: string;
  service: string;
}

function ReviewCardItem({ review }: { review: ReviewCard }) {
  const color = serviceColor[review.service] ?? "#625548";
  const initials = review.client
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex-none w-[340px] sm:w-[380px] border-r border-y border-foreground/8 first:border-l bg-surface p-6 flex flex-col gap-4 hover:bg-background hover:border-foreground/15 transition-colors duration-300 -ml-px">
      {/* Header — avatar + name + service */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-medium tracking-wide"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{review.client}</p>
          <p className="text-[10px] tracking-[0.15em] uppercase" style={{ color }}>
            {serviceLabel[review.service] ?? review.service}
          </p>
        </div>
      </div>

      {/* Quote */}
      <blockquote className="text-sm text-muted leading-relaxed">
        &ldquo;{review.text}&rdquo;
      </blockquote>
    </div>
  );
}

function MarqueeRow({
  reviews,
  direction,
  duration,
}: {
  reviews: ReviewCard[];
  direction: "left" | "right";
  duration: number;
}) {
  // Duplicate for seamless loop
  const items = [...reviews, ...reviews];

  return (
    <div className="group relative overflow-hidden">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 md:w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

      <div
        className="flex w-max group-hover:[animation-play-state:paused]"
        style={{
          animation: `marquee-${direction} ${duration}s linear infinite`,
        }}
      >
        {items.map((review, i) => (
          <ReviewCardItem key={`${review.id}-${i}`} review={review} />
        ))}
      </div>
    </div>
  );
}

export function Testimonials({ reviews: dbReviews }: { reviews?: FeaturedReview[] } = {}) {
  const reviews =
    dbReviews && dbReviews.length > 0
      ? dbReviews.map((r) => ({
          id: String(r.id),
          client: r.client,
          text: r.body ?? "",
          service: r.serviceName ?? "general",
        }))
      : PLACEHOLDER_REVIEWS;

  // Split into two rows
  const mid = Math.ceil(reviews.length / 2);
  const topRow = reviews.slice(0, mid);
  const bottomRow = reviews.slice(mid);

  return (
    <section
      id="testimonials"
      aria-label="Client testimonials"
      className="bg-background py-32 md:py-48 overflow-hidden"
    >
      <div className="mx-auto max-w-6xl px-6 md:px-12 mb-16 md:mb-20">
        <span className="text-[10px] tracking-[0.35em] uppercase text-muted mb-4 block">
          What Clients Say
        </span>
        <h2 className="font-display text-4xl md:text-6xl font-light tracking-tight text-foreground leading-[1.0]">
          Their words.
        </h2>
      </div>

      <div className="flex flex-col">
        <MarqueeRow reviews={topRow} direction="left" duration={40} />
        <MarqueeRow reviews={bottomRow} direction="right" duration={45} />
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes marquee-left {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          from { transform: translateX(-50%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </section>
  );
}
