/**
 * Events — Showcase event offerings (parties, pop-ups, bridal, corporate).
 *
 * Dark inverted section — editorial layout, text only, no card boxes.
 * Thin dividers between items, single CTA at the bottom.
 *
 * Props (all optional):
 * - eventDescriptions: override event titles/descriptions from admin dashboard.
 *   Falls back to FALLBACK_EVENTS when not provided.
 */

import Link from "next/link";

const FALLBACK_EVENTS = [
  {
    title: "Private Lash Parties",
    detail: "Up to 6 guests",
    description:
      "Book the studio for you and your group. Everyone gets lashed while you celebrate — birthdays, bachelorettes, girls' night.",
  },
  {
    title: "Pop-Up Events",
    detail: "Travel available",
    description:
      "Permanent jewelry welding at your venue, market, or storefront. Full setup provided — we bring the studio to you.",
  },
  {
    title: "Bridal & Wedding",
    detail: "Custom packages",
    description:
      "Day-of lash services and permanent jewelry for the bridal party. Coordinated scheduling so everyone is ready on time.",
  },
  {
    title: "Corporate & Team Events",
    detail: "Groups of 10+",
    description:
      "Team bonding with permanent jewelry or beauty services. Great for offsites, retreats, and company milestones.",
  },
];

const EVENT_DETAILS: Record<string, string> = {
  "Private Lash Parties": "Up to 6 guests",
  "Pop-Up Events": "Travel available",
  "Bridal & Wedding": "Custom packages",
  "Corporate & Team Events": "Groups of 10+",
};

export function Events({
  eventDescriptions,
}: {
  eventDescriptions?: { title: string; description: string }[];
} = {}) {
  const events = eventDescriptions
    ? eventDescriptions.map((e) => ({
        ...e,
        detail: EVENT_DETAILS[e.title] ?? "Available",
      }))
    : FALLBACK_EVENTS;

  return (
    <section className="bg-foreground text-background py-28 md:py-40 px-6" aria-label="Events">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-16 md:mb-20">
          <span className="text-[10px] tracking-[0.3em] uppercase text-background/60 mb-5 block">
            Events
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-light tracking-tight text-background leading-[1.1] mb-4">
            Bring the studio to you.
          </h2>
          <p className="text-sm text-background/70 leading-relaxed max-w-lg">
            Private parties, pop-ups, bridal services, and corporate events. The full T Creative
            experience — wherever you need it.
          </p>
        </div>

        {/* Event list */}
        <div>
          {events.map((event) => (
            <div
              key={event.title}
              className="group border-t border-background/10 py-8 md:py-10 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-12"
            >
              <span className="text-[10px] tracking-[0.2em] uppercase text-background/50 shrink-0 sm:w-32 sm:pt-1">
                {event.detail}
              </span>
              <div>
                <h3 className="text-base md:text-lg font-light text-background mb-2 tracking-tight group-hover:text-accent transition-colors duration-200">
                  {event.title}
                </h3>
                <p className="text-sm text-background/70 leading-relaxed">{event.description}</p>
              </div>
            </div>
          ))}
          <div className="border-t border-background/10" />
        </div>

        {/* CTA */}
        <div className="mt-12">
          <Link
            href="/contact"
            className="inline-flex items-center gap-3 text-xs tracking-[0.2em] uppercase text-background/70 hover:text-background transition-colors duration-200 group"
          >
            <span>Inquire About an Event</span>
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
