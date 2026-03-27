/**
 * CallToAction — Final conversion section with booking and ecosystem CTAs.
 *
 * Used at the bottom of the landing page to drive bookings and exploration.
 * Fires PostHog analytics events on CTA clicks.
 *
 * No props — copy and links are static.
 */
"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { Button } from "@/components/ui/Button";

export function CallToAction() {
  return (
    <section id="booking" className="bg-hover py-32 md:py-48 px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl md:text-6xl font-light tracking-tight text-foreground mb-8">
          The studio is open.
        </h2>

        <p className="text-lg text-muted leading-relaxed mb-12">
          Whether you&apos;re booking your first appointment or managing your entire creative
          practice — there is a place here, already built for you.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild>
            <Link
              href="/contact"
              onClick={() =>
                posthog.capture("cta_clicked", { cta: "book_session", location: "landing_bottom" })
              }
            >
              Book a Session
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link
              href="/services"
              onClick={() =>
                posthog.capture("cta_clicked", {
                  cta: "explore_ecosystem",
                  location: "landing_bottom",
                })
              }
            >
              Explore the Ecosystem
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
