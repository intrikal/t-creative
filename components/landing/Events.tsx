/**
 * Events — Showcase event offerings (parties, pop-ups, bridal, corporate).
 *
 * Dark inverted section — editorial layout with SVG icons per event type.
 * Firecrawl-inspired hover: accent bar slides in from left, title shifts,
 * arrow animates in. Thin dividers between items, single CTA at the bottom.
 */

import Link from "next/link";

// ── SVG Icons ────────────────────────────────────────────────────────────────

function ChampagneIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" className="w-6 h-6">
      <path
        d="M11 4h6l1 10a5 5 0 01-8 0l1-10z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <line x1="14" y1="14" x2="14" y2="22" stroke="currentColor" strokeWidth="1.2" />
      <line
        x1="10"
        y1="22"
        x2="18"
        y2="22"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="13" cy="8" r="0.8" fill="currentColor" opacity="0.5" />
      <circle cx="15.5" cy="6.5" r="0.6" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" className="w-6 h-6">
      <path
        d="M14 4a7 7 0 017 7c0 5-7 13-7 13S7 16 7 11a7 7 0 017-7z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="14" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function RingsIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" className="w-6 h-6">
      <circle cx="11" cy="14" r="6" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="17" cy="14" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M14 9.5a6 6 0 010 9" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" className="w-6 h-6">
      <rect x="5" y="8" width="18" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="5" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <rect
        x="9"
        y="15"
        width="3"
        height="3"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.6"
      />
      <rect
        x="16"
        y="15"
        width="3"
        height="3"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.6"
      />
      <rect x="12" y="20" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="0.8" />
    </svg>
  );
}

const EVENT_ICONS: Record<string, React.FC> = {
  "Private Lash Parties": ChampagneIcon,
  "Pop-Up Events": MapPinIcon,
  "Bridal & Wedding": RingsIcon,
  "Corporate & Team Events": BuildingIcon,
};

// ── Fallback data ────────────────────────────────────────────────────────────

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

// ── Component ────────────────────────────────────────────────────────────────

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
    <section
      className="relative bg-foreground text-background py-28 md:py-40 px-6 md:px-12"
      aria-label="Events"
    >
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-16 md:mb-20">
          <span className="text-[10px] tracking-[0.3em] uppercase text-background/60 mb-4 block">
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
          {events.map((event) => {
            const Icon = EVENT_ICONS[event.title];
            return (
              <div
                key={event.title}
                className="group relative border-t border-background/10 py-8 md:py-10 flex items-start gap-5 sm:gap-8 cursor-default"
              >
                {/* Accent bar — slides in from left on hover */}
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent-decorative origin-top scale-y-0 transition-transform duration-500 group-hover:scale-y-100" />

                {/* Icon */}
                {Icon && (
                  <div className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-background/8 text-background/50 group-hover:text-background/90 group-hover:bg-background/12 transition-colors duration-300 mt-0.5">
                    <Icon />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-3 mb-2">
                    <h3
                      className="text-xl md:text-2xl font-display font-light text-background/90 tracking-tight group-hover:text-background transition-colors duration-300 group-hover:translate-x-1 transform-gpu"
                      style={{ transition: "color 0.3s, transform 0.3s" }}
                    >
                      {event.title}
                    </h3>
                    <span className="text-[10px] tracking-[0.25em] uppercase text-background/30 group-hover:text-background/50 transition-colors duration-300">
                      {event.detail}
                    </span>
                  </div>
                  <p className="text-sm text-background/60 leading-relaxed group-hover:text-background/70 transition-colors duration-300">
                    {event.description}
                  </p>
                </div>

                {/* Arrow — fades in on hover */}
                <span className="shrink-0 text-background/0 group-hover:text-background/60 transition-all duration-300 translate-x-2 group-hover:translate-x-0 mt-2 text-lg select-none">
                  →
                </span>
              </div>
            );
          })}
          <div className="border-t border-background/10" />
        </div>

        {/* CTA */}
        <div className="mt-12">
          <Link
            href="/contact"
            className="inline-flex items-center gap-3 text-xs tracking-[0.2em] uppercase text-background/70 hover:text-background transition-colors duration-300 group"
            data-cursor="link"
            data-magnetic="0.2"
          >
            <span>Inquire About an Event</span>
            <span className="w-6 h-px bg-current block transition-all duration-300 group-hover:w-10" />
          </Link>
        </div>
      </div>
    </section>
  );
}
