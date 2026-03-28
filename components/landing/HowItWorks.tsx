/**
 * HowItWorks — Five-step booking process with alternating text + illustration.
 *
 * Apollo-style: each step is a 2-column row. Odd steps have text left / visual
 * right; even steps flip. Each visual is a minimal SVG illustration tied to the
 * step's meaning. Numbered badge sits above the title.
 */

import Link from "next/link";

// ── Step illustrations ───────────────────────────────────────────────────────

function BrowseIllustration() {
  return (
    <svg viewBox="0 0 280 200" fill="none" className="w-full h-full">
      {/* Browser window */}
      <rect
        x="40"
        y="30"
        width="200"
        height="140"
        rx="8"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.2"
      />
      <rect x="40" y="30" width="200" height="24" rx="8" fill="currentColor" opacity="0.04" />
      <circle cx="56" cy="42" r="4" fill="#C4907A" opacity="0.5" />
      <circle cx="68" cy="42" r="4" fill="#D4A574" opacity="0.5" />
      <circle cx="80" cy="42" r="4" fill="#7BA3A3" opacity="0.5" />
      {/* Content cards */}
      <rect
        x="56"
        y="68"
        width="72"
        height="48"
        rx="4"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.12"
      />
      <rect x="56" y="68" width="72" height="28" rx="4" fill="#C4907A" opacity="0.08" />
      <rect x="60" y="100" width="40" height="4" rx="2" fill="currentColor" opacity="0.08" />
      <rect x="60" y="108" width="28" height="4" rx="2" fill="currentColor" opacity="0.05" />
      <rect
        x="148"
        y="68"
        width="72"
        height="48"
        rx="4"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.12"
      />
      <rect x="148" y="68" width="72" height="28" rx="4" fill="#D4A574" opacity="0.08" />
      <rect x="152" y="100" width="40" height="4" rx="2" fill="currentColor" opacity="0.08" />
      <rect x="152" y="108" width="28" height="4" rx="2" fill="currentColor" opacity="0.05" />
      <rect
        x="56"
        y="126"
        width="72"
        height="28"
        rx="4"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.08"
      />
      <rect
        x="148"
        y="126"
        width="72"
        height="28"
        rx="4"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.08"
      />
    </svg>
  );
}

function CalendarIllustration() {
  return (
    <svg viewBox="0 0 280 200" fill="none" className="w-full h-full">
      {/* Calendar frame */}
      <rect
        x="60"
        y="40"
        width="160"
        height="130"
        rx="8"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.2"
      />
      <rect x="60" y="40" width="160" height="28" rx="8" fill="currentColor" opacity="0.04" />
      <rect x="76" y="50" width="48" height="8" rx="3" fill="currentColor" opacity="0.1" />
      {/* Grid cells */}
      {[0, 1, 2, 3, 4].map((col) =>
        [0, 1, 2].map((row) => (
          <rect
            key={`${col}-${row}`}
            x={72 + col * 28}
            y={78 + row * 28}
            width="22"
            height="22"
            rx="4"
            fill="currentColor"
            opacity={col === 2 && row === 1 ? 0.08 : 0.02}
            stroke={col === 2 && row === 1 ? "#C4907A" : "currentColor"}
            strokeWidth={col === 2 && row === 1 ? 1.5 : 0}
          />
        )),
      )}
      {/* Selected indicator */}
      <circle cx={72 + 2 * 28 + 11} cy={78 + 1 * 28 + 11} r="3" fill="#C4907A" opacity="0.6" />
    </svg>
  );
}

function ConfirmIllustration() {
  return (
    <svg viewBox="0 0 280 200" fill="none" className="w-full h-full">
      {/* Message card */}
      <rect
        x="60"
        y="50"
        width="160"
        height="100"
        rx="8"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.2"
      />
      {/* Avatar */}
      <circle cx="84" cy="76" r="10" fill="#C4907A" opacity="0.15" />
      <text
        x="84"
        y="80"
        textAnchor="middle"
        fontSize="9"
        fill="#C4907A"
        fontWeight="500"
        opacity="0.7"
      >
        T
      </text>
      {/* Message lines */}
      <rect x="100" y="70" width="100" height="5" rx="2" fill="currentColor" opacity="0.08" />
      <rect x="100" y="80" width="72" height="5" rx="2" fill="currentColor" opacity="0.05" />
      {/* Checkmark */}
      <circle cx="140" cy="120" r="12" fill="#4e6b51" opacity="0.1" />
      <path
        d="M134 120l4 4 8-8"
        stroke="#4e6b51"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
    </svg>
  );
}

function StudioIllustration() {
  return (
    <svg viewBox="0 0 280 200" fill="none" className="w-full h-full">
      {/* Door frame */}
      <rect
        x="100"
        y="40"
        width="80"
        height="120"
        rx="6"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.2"
      />
      <rect x="100" y="40" width="80" height="16" rx="6" fill="currentColor" opacity="0.04" />
      {/* Door panels */}
      <rect
        x="108"
        y="62"
        width="28"
        height="50"
        rx="3"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.1"
      />
      <rect
        x="144"
        y="62"
        width="28"
        height="50"
        rx="3"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.1"
      />
      {/* Door handle */}
      <circle cx="140" cy="100" r="3" fill="#D4A574" opacity="0.4" />
      {/* Welcome mat */}
      <rect x="90" y="160" width="100" height="8" rx="4" fill="#C4907A" opacity="0.08" />
      {/* Warm glow from door */}
      <ellipse cx="140" cy="90" rx="30" ry="40" fill="#D4A574" opacity="0.04" />
    </svg>
  );
}

function GlowIllustration() {
  return (
    <svg viewBox="0 0 280 200" fill="none" className="w-full h-full">
      {/* Sparkle / star burst */}
      <circle cx="140" cy="100" r="28" fill="#C4907A" opacity="0.06" />
      <circle cx="140" cy="100" r="16" fill="#C4907A" opacity="0.08" />
      {/* Star lines */}
      {[0, 45, 90, 135].map((angle) => (
        <line
          key={angle}
          x1={140 + Math.cos((angle * Math.PI) / 180) * 20}
          y1={100 + Math.sin((angle * Math.PI) / 180) * 20}
          x2={140 + Math.cos((angle * Math.PI) / 180) * 40}
          y2={100 + Math.sin((angle * Math.PI) / 180) * 40}
          stroke="#C4907A"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.25"
        />
      ))}
      {/* Phone / rebooking hint */}
      <rect
        x="168"
        y="120"
        width="36"
        height="56"
        rx="6"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.15"
      />
      <rect x="174" y="134" width="24" height="8" rx="2" fill="#C4907A" opacity="0.1" />
      <rect x="174" y="146" width="16" height="4" rx="2" fill="currentColor" opacity="0.06" />
    </svg>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    number: "01",
    title: "Browse Services",
    description:
      "Explore lash extensions, permanent jewelry, custom crochet, 3D-printed accessories, and business consulting. Every service page shows exactly what to expect — timing, pricing, and what's included.",
    illustration: BrowseIllustration,
  },
  {
    number: "02",
    title: "Book Online",
    description:
      "Pick your service and choose a date and time that works for you. The booking form takes less than two minutes — no phone calls, no waiting for a reply.",
    illustration: CalendarIllustration,
  },
  {
    number: "03",
    title: "Confirm Your Appointment",
    description:
      "Trini personally reviews every new booking and sends you a confirmation. You'll receive the studio address, arrival instructions, and anything you need to prepare — all in one message.",
    illustration: ConfirmIllustration,
  },
  {
    number: "04",
    title: "Arrive & Relax",
    description:
      "Show up at your scheduled time. The studio is set up and ready before you walk in. Every detail has been considered so you can focus on the experience.",
    illustration: StudioIllustration,
  },
  {
    number: "05",
    title: "Leave Glowing",
    description:
      "Walk out with results you'll love and aftercare guidance to keep them looking great. Rebooking takes seconds — your next appointment is always just a tap away.",
    illustration: GlowIllustration,
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export function HowItWorks() {
  return (
    <section
      className="relative bg-background pt-16 md:pt-24 pb-32 md:pb-48 px-6"
      aria-label="How it works"
    >
      <div className="relative z-10 mx-auto max-w-5xl">
        <div className="mb-20 md:mb-28 text-center">
          <span className="text-[10px] tracking-[0.3em] uppercase text-muted mb-4 block">
            How It Works
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-light tracking-tight text-foreground leading-[1.1]">
            Simple from start to finish.
          </h2>
          <p className="mt-4 text-sm text-muted max-w-md mx-auto">
            Every booking is personal. Here&apos;s exactly what happens from the moment you reach
            out.
          </p>
        </div>

        {/* Alternating rows */}
        <div className="flex flex-col gap-20 md:gap-28">
          {STEPS.map((step, i) => {
            const Illustration = step.illustration;
            const isReversed = i % 2 === 1;

            return (
              <div
                key={step.number}
                className={`flex flex-col md:flex-row items-center gap-10 md:gap-16 ${
                  isReversed ? "md:flex-row-reverse" : ""
                }`}
              >
                {/* Text side */}
                <div className="flex-1">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-foreground/[0.04] text-foreground/30 font-display text-sm font-light tracking-wide mb-5">
                    {step.number}
                  </span>
                  <h3 className="font-display text-2xl md:text-3xl font-light text-foreground mb-4 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed max-w-md">{step.description}</p>
                </div>

                {/* Illustration side */}
                <div className="flex-1 w-full max-w-sm md:max-w-none">
                  <div className="aspect-[7/5] rounded-2xl bg-foreground/[0.02] border border-foreground/6 flex items-center justify-center text-foreground">
                    <Illustration />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-20 text-center">
          <Link
            href="/contact"
            className="inline-flex items-center gap-3 text-xs tracking-[0.2em] uppercase text-foreground hover:text-accent transition-colors duration-300 group"
            data-cursor="link"
            data-magnetic="0.2"
          >
            Book an Appointment
            <span className="w-6 h-px bg-current block transition-all duration-300 group-hover:w-10" />
          </Link>
        </div>
      </div>
    </section>
  );
}
