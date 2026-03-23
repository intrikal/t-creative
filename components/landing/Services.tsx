/**
 * Services — Lists core service offerings with zone colors, pricing, and CTAs.
 *
 * Used on the landing page to present the four service verticals with pricing and booking links.
 * Client Component — uses Framer Motion for staggered scroll-reveal animations.
 *
 * No props — service data is static. Zone colors and CTA hrefs are pulled from the ZONES config.
 */
"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { SectionWrapper } from "@/components/ui/SectionWrapper";
import { ZONES, type ZoneId } from "@/lib/zones";

// Service definitions — each entry ties to a ZoneId from the shared zones config.
// Typed inline to enforce the shape without a separate interface, since this array is only used here.
const services: {
  zoneId: ZoneId;
  title: string;
  description: string;
  price: string;
  cta: string;
}[] = [
  {
    zoneId: "lash",
    title: "Lash Extensions",
    description:
      "Classic, hybrid, or volume sets — each lash carefully applied to enhance your natural beauty.",
    price: "Starting at $150",
    cta: "Find Your Set",
  },
  {
    zoneId: "jewelry",
    title: "Permanent Jewelry",
    description:
      "14k gold-filled and sterling silver chains, custom-fit and welded on. Bracelets, anklets, and necklaces — clasp-free and waterproof.",
    price: "Starting at $55",
    cta: "Link a Memory",
  },
  {
    zoneId: "crochet",
    title: "Crochet Hair & Crafts",
    description:
      "Custom crochet hair installs — box braids, goddess locs, knotless braids, and more. Also handcrafted accessories, bags, and commissioned pieces.",
    price: "Starting at $80",
    cta: "Commission a Piece",
  },
  {
    zoneId: "consulting",
    title: "Business Consulting",
    description:
      "HR strategy and business consulting for entrepreneurs and small businesses ready to grow.",
    price: "Contact for Quote",
    cta: "Learn More",
  },
];

export function Services() {
  return (
    <SectionWrapper id="services" className="py-32 md:py-48 px-6">
      <div className="mx-auto max-w-5xl">
        <m.div
          className="mb-16 md:mb-24 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-xs tracking-widest uppercase text-muted mb-6 block">Services</span>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-foreground">
            Four passions, one mission.
          </h2>
          <p className="mt-4 text-muted text-base max-w-lg mx-auto">
            Helping you feel confident, beautiful, and empowered.
          </p>
        </m.div>

        <div className="flex flex-col gap-0">
          {/* .map() over services to render each as a horizontal row with zone dot, text, and CTA.
              Array-driven to keep stagger delay (i * 0.1) uniform. Each iteration looks up the
              zone config via ZONES[service.zoneId] to get the brand color and CTA href — this
              avoids duplicating zone data and ensures consistency with the rest of the site. */}
          {services.map((service, i) => {
            const zone = ZONES[service.zoneId];
            return (
              <m.div
                key={service.title}
                className="group relative border-t border-foreground/10 py-10 md:py-14 flex flex-col md:flex-row md:items-start gap-4 md:gap-12"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5"
                  style={{ backgroundColor: zone.color }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4 mb-3">
                    <h3 className="text-xl md:text-2xl font-light tracking-tight text-foreground group-hover:text-accent transition-colors duration-300">
                      {service.title}
                    </h3>
                    <span className="text-sm text-accent font-medium">{service.price}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted max-w-xl">
                    {service.description}
                  </p>
                </div>

                <Link
                  href={zone.cta.href}
                  className="flex-shrink-0 text-xs tracking-widest uppercase text-foreground hover:text-accent transition-colors duration-300 border border-foreground/20 hover:border-accent/40 px-6 py-3 self-start hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  {service.cta}
                </Link>
              </m.div>
            );
          })}
          <div className="border-t border-foreground/10" />
        </div>

        <m.div
          className="mt-12 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Link
            href="/services"
            className="text-sm tracking-widest uppercase text-accent hover:text-foreground transition-colors duration-300 border-b border-accent/40 pb-1"
          >
            View All Services & Pricing
          </Link>
        </m.div>
      </div>
    </SectionWrapper>
  );
}
