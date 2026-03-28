"use client";

import Link from "next/link";
import posthog from "posthog-js";

export function CallToAction() {
  return (
    <section
      id="booking"
      className="min-h-screen flex items-center justify-center px-6 bg-surface"
      aria-label="Book a session"
    >
      <div className="max-w-2xl w-full text-center">
        <span className="text-[10px] tracking-[0.35em] uppercase text-muted mb-8 block">
          Ready when you are
        </span>

        <h2 className="font-display text-5xl md:text-7xl lg:text-[8rem] font-light tracking-tight text-foreground leading-[0.95] mb-12">
          The studio
          <br />
          is open.
        </h2>

        <p className="text-base text-muted leading-relaxed mb-14 max-w-sm mx-auto">
          Whether it&apos;s your first appointment or your tenth — there is a place here, already
          built for you.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/contact"
            onClick={() =>
              posthog.capture("cta_clicked", { cta: "book_session", location: "landing_bottom" })
            }
            className="inline-flex items-center justify-center gap-3 text-[10px] tracking-[0.25em] uppercase text-foreground border border-foreground/30 hover:bg-foreground hover:text-background px-10 py-5 transition-colors duration-500"
          >
            Book a Session
          </Link>
          <Link
            href="/services"
            onClick={() =>
              posthog.capture("cta_clicked", {
                cta: "explore_services",
                location: "landing_bottom",
              })
            }
            className="inline-flex items-center justify-center gap-3 text-[10px] tracking-[0.25em] uppercase text-muted hover:text-foreground transition-colors duration-300 px-10 py-5"
          >
            Explore Services
          </Link>
        </div>

        <p className="mt-14 text-[10px] tracking-[0.2em] uppercase text-muted/40">
          San Jose, CA &nbsp;·&nbsp; By appointment
        </p>
      </div>
    </section>
  );
}
