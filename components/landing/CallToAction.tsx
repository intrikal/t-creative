/**
 * CallToAction — Final conversion section with booking and ecosystem CTAs.
 *
 * Client Component — uses Framer Motion for scroll-triggered fade-in animation.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import posthog from "posthog-js";
import { Button } from "@/components/ui/Button";

export function CallToAction() {
  return (
    <section id="booking" className="bg-hover py-32 md:py-48 px-6">
      <motion.div
        className="mx-auto max-w-2xl text-center"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
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
      </motion.div>
    </section>
  );
}
