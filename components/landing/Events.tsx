/**
 * Events — Showcase event offerings (parties, pop-ups, bridal, corporate).
 *
 * Used on the landing page to promote group/event services.
 * Client Component — uses Framer Motion for staggered scroll-reveal.
 *
 * Props (all optional):
 * - eventDescriptions: override event titles/descriptions from admin dashboard.
 *   Falls back to FALLBACK_EVENTS when not provided (first deploy or no admin config).
 */
"use client";

import Link from "next/link";
import { m } from "framer-motion";

// Default event descriptions used when no admin-configured events are provided.
// Array of {title, description} objects — same shape as the optional prop.
const FALLBACK_EVENTS = [
  {
    title: "Private Lash Parties",
    description:
      "Book the studio for you and your group. Everyone gets lashed while you celebrate — birthdays, bachelorettes, girls' night.",
  },
  {
    title: "Pop-Up Events",
    description:
      "Permanent jewelry welding at your venue, market, or storefront. Full setup provided — we bring the studio to you.",
  },
  {
    title: "Bridal & Wedding",
    description:
      "Day-of lash services and permanent jewelry for the bridal party. Coordinated scheduling so everyone is ready on time.",
  },
  {
    title: "Corporate & Team Events",
    description:
      "Team bonding with permanent jewelry or beauty services. Great for offsites, retreats, and company milestones.",
  },
];

// Metadata lookup — maps event titles to detail text and zone color.
// Record<string, ...> chosen over an array because lookups are by title (O(1) vs O(n)).
// Falls back to DEFAULT_DETAIL for any unrecognized event title.
const EVENT_DETAILS: Record<string, { detail: string; color: string }> = {
  "Private Lash Parties": { detail: "Up to 6 guests", color: "#C4907A" },
  "Pop-Up Events": { detail: "Travel available", color: "#D4A574" },
  "Bridal & Wedding": { detail: "Custom packages", color: "#C4907A" },
  "Corporate & Team Events": { detail: "Groups of 10+", color: "#5B8A8A" },
};

const DEFAULT_DETAIL = { detail: "Available", color: "#C4907A" };

export function Events({
  eventDescriptions,
}: {
  eventDescriptions?: { title: string; description: string }[];
} = {}) {
  // Nullish coalescing: use prop events if provided, otherwise fall back to hardcoded defaults.
  const events = eventDescriptions ?? FALLBACK_EVENTS;
  return (
    <section className="py-28 md:py-40 px-6 bg-surface" aria-label="Events">
      <div className="mx-auto max-w-5xl">
        <m.div
          className="mb-16 md:mb-20"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-[10px] tracking-[0.3em] uppercase text-muted mb-5 block">
            Events
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-light tracking-tight text-foreground leading-[1.1] mb-4">
            Bring the studio to you.
          </h2>
          <p className="text-sm text-muted leading-relaxed max-w-lg">
            Private parties, pop-ups, bridal services, and corporate events. The full T Creative
            experience — wherever you need it.
          </p>
        </m.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {/* .map() renders event cards with stagger delay (i * 0.1).
              Each iteration looks up metadata via EVENT_DETAILS[event.title] with nullish
              coalescing fallback to DEFAULT_DETAIL for any title not in the lookup. */}
          {events.map((event, i) => {
            const meta = EVENT_DETAILS[event.title] ?? DEFAULT_DETAIL;
            return (
              <m.div
                key={event.title}
                className="border border-foreground/8 p-6 md:p-8 hover:border-foreground/20 transition-all duration-300 group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                  <span className="text-[10px] tracking-[0.2em] uppercase text-muted">
                    {meta.detail}
                  </span>
                </div>
                <h3 className="text-base font-medium text-foreground mb-2 group-hover:text-accent transition-colors duration-200">
                  {event.title}
                </h3>
                <p className="text-sm text-muted leading-relaxed">{event.description}</p>
              </m.div>
            );
          })}
        </div>

        <m.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Link
            href="/contact"
            className="inline-flex items-center gap-3 text-xs tracking-[0.2em] uppercase text-foreground group"
          >
            <span className="nav-link-reveal pb-px">Inquire About an Event</span>
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </Link>
        </m.div>
      </div>
    </section>
  );
}
