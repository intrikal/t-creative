/**
 * TrainingTeaser — Certification programs preview with hover polish.
 *
 * Sticky left positioning copy + right-side program rows. Hover interactions:
 * - Colored dot pulses / scales up
 * - Accent bar slides in from left
 * - "Details →" arrow slides right
 * - Row background subtly warms
 */

import Link from "next/link";

const PROGRAMS = [
  {
    title: "Classic Lash Certification",
    duration: "2 weekends · 16 hours",
    price: "From $1,800",
    color: "#C4907A",
  },
  {
    title: "Volume Lash Certification",
    duration: "3 weekends · 24 hours",
    price: "From $2,200",
    color: "#C4907A",
  },
  {
    title: "Permanent Jewelry Certification",
    duration: "1 day · 8 hours",
    price: "From $1,200",
    color: "#D4A574",
  },
  {
    title: "Beauty Business Bootcamp",
    duration: "3 sessions · 18 hours",
    price: "From $450",
    color: "#5B8A8A",
  },
];

export function TrainingTeaser() {
  return (
    <section className="bg-surface py-28 md:py-40 px-6 md:px-12" aria-label="Training programs">
      <div className="mx-auto max-w-6xl">
        <div className="grid md:grid-cols-2 gap-16 md:gap-24 items-start">
          {/* Left — positioning */}
          <div className="md:sticky md:top-24">
            <span className="text-[10px] tracking-[0.3em] uppercase text-muted mb-4 block">
              Education
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-light tracking-tight text-foreground leading-[1.1] mb-6">
              Learn from
              <br />
              the source.
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-6">
              Every technique taught here is the same one behind every T Creative service. Hands-on,
              small cohorts, real clients.
            </p>
            <p className="text-sm text-muted leading-relaxed mb-10">
              For lash artists, jewelry welders, and beauty entrepreneurs who are done watching
              tutorials and ready to actually build the skill.
            </p>
            <Link
              href="/training"
              className="inline-flex items-center gap-3 text-xs tracking-[0.2em] uppercase text-foreground hover:text-accent transition-colors duration-300 group"
              data-cursor="link"
              data-magnetic="0.2"
            >
              View All Programs
              <span className="w-6 h-px bg-current block transition-all duration-300 group-hover:w-10" />
            </Link>
          </div>

          {/* Right — program rows */}
          <div>
            {PROGRAMS.map((program) => (
              <div
                key={program.title}
                className="group border-t border-foreground/10 py-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 transition-transform duration-300 group-hover:scale-150"
                    style={{ backgroundColor: program.color }}
                  />
                  <div>
                    <p className="text-base font-light text-foreground tracking-tight group-hover:text-accent transition-colors duration-300">
                      {program.title}
                    </p>
                    <p className="text-[11px] tracking-[0.15em] uppercase text-muted mt-1">
                      {program.duration}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 pl-5 sm:pl-0">
                  <span className="text-sm text-foreground font-light tabular-nums">
                    {program.price}
                  </span>
                  <Link
                    href="/training"
                    className="group/link flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-muted hover:text-foreground transition-colors duration-300 shrink-0"
                    data-cursor="link"
                  >
                    Details
                    <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">
                      →
                    </span>
                  </Link>
                </div>
              </div>
            ))}
            <div className="border-t border-foreground/10" />
          </div>
        </div>
      </div>
    </section>
  );
}
