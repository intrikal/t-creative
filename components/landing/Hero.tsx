/**
 * Hero — Full-width hero section with headline, tagline, CTAs, and founder photo.
 *
 * Used at the top of the landing page as the primary above-the-fold content.
 * Client Component — fires PostHog analytics events on CTA clicks.
 *
 * Props (all optional):
 * - headline: override the default headline JSX
 * - subheadline: override the default description text
 * - ctaText: override the primary CTA button label
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import posthog from "posthog-js";
import { Button } from "@/components/ui/Button";

export function Hero({
  headline,
  subheadline,
  ctaText,
}: {
  headline?: string;
  subheadline?: string;
  ctaText?: string;
}) {
  return (
    <section className="pt-28 pb-20 md:pt-32 md:pb-28 px-6 overflow-hidden">
      <div className="mx-auto max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
        {/* Text side */}
        <div>
          <span className="inline-block text-xs tracking-widest uppercase text-accent mb-8 border border-accent/20 px-4 py-2 rounded-full">
            Premium Beauty &amp; Creative Services
          </span>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight text-foreground leading-[1.1] mb-6">
            {headline ?? (
              <>
                Where Artistry
                <br />
                Meets <span className="text-accent">Transformation</span>
              </>
            )}
          </h1>

          <p className="text-base text-muted leading-relaxed max-w-lg mb-8">
            {subheadline ??
              "Premium lash extensions, permanent jewelry, custom crochet commissions, and business consulting. Every creation crafted with intention and care, serving San Jose and the Bay Area."}
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button asChild>
              <Link
                href="/contact"
                onClick={() =>
                  posthog.capture("cta_clicked", { cta: "book_appointment", location: "hero" })
                }
              >
                {ctaText ?? "Book Appointment"}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link
                href="/services"
                onClick={() =>
                  posthog.capture("cta_clicked", { cta: "view_services", location: "hero" })
                }
              >
                View Services &amp; Pricing
              </Link>
            </Button>
          </div>

          {/* Quick service links */}
          <div className="flex flex-wrap gap-3 mt-8">
            {[
              { label: "Lash Extensions", href: "/services" },
              { label: "Permanent Jewelry", href: "/services" },
              { label: "Crochet", href: "/services" },
            ].map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="text-xs tracking-wide text-muted hover:text-foreground border border-foreground/10 hover:border-foreground/25 px-4 py-2 transition-colors duration-200"
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Photo side */}
        <div className="flex justify-center md:justify-end">
          <div className="w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden shadow-xl">
            <Image
              src="/images/trini.jpg"
              alt="Trini Lam — founder of T Creative Studio"
              width={320}
              height={320}
              className="object-cover w-full h-full"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
