"use client";

/**
 * Services — 2×2 grid cards with zone-colored accents and hover animations.
 *
 * Inspired by Firecrawl's card grid: subtle borders, accent bar on hover,
 * gentle scale + shadow lift. Each card uses its zone color for the accent.
 */

import Link from "next/link";
import { ZONES, type ZoneId } from "@/lib/zones";

const services: {
  zoneId: ZoneId;
  title: string;
  description: string;
  price: string;
  cta: string;
  icon: React.ReactNode;
}[] = [
  {
    zoneId: "lash",
    title: "Lash Extensions",
    description:
      "Every set is built around your eye shape, your lifestyle, and how you want to feel. Classic, hybrid, or full volume — applied one lash at a time, by hand.",
    price: "From $150",
    cta: "Find Your Set",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <path
          d="M6 22c4-8 10-14 20-16"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M6 22c6-6 12-10 20-10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d="M6 22c8-4 14-6 20-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.3"
        />
      </svg>
    ),
  },
  {
    zoneId: "jewelry",
    title: "Permanent Jewelry",
    description:
      "14k gold-filled or sterling silver, sized to your wrist and welded shut. No clasp. No taking it off. Just something beautiful that stays.",
    price: "From $55",
    cta: "Link a Memory",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <circle cx="16" cy="16" r="9" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="16" cy="16" r="5" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        <circle cx="16" cy="7" r="1.5" fill="currentColor" opacity="0.7" />
      </svg>
    ),
  },
  {
    zoneId: "crochet",
    title: "Crochet & Craft",
    description:
      "Box braids, goddess locs, knotless installs — each one hand-crafted to fit your vision. Also handmade accessories, bags, and 3D-printed commissioned pieces.",
    price: "From $80",
    cta: "Commission a Piece",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <path
          d="M8 24c2-4 4-6 8-6s6 2 8 6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M10 18c1.5-3 3-5 6-5s4.5 2 6 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M12 12c1-2 2-3.5 4-3.5s3 1.5 4 3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.3"
        />
      </svg>
    ),
  },
  {
    zoneId: "consulting",
    title: "Business Consulting",
    description:
      "For beauty entrepreneurs who are ready to build something real. HR strategy, operations, and the infrastructure to support a business that scales.",
    price: "Quote on Request",
    cta: "Start a Conversation",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="w-7 h-7">
        <rect x="6" y="10" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 14h20" stroke="currentColor" strokeWidth="1" opacity="0.4" />
        <path
          d="M11 19h10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.6"
        />
        <path
          d="M11 22h6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.3"
        />
      </svg>
    ),
  },
];

function ServiceCard({ service }: { service: (typeof services)[0] }) {
  const zone = ZONES[service.zoneId];

  return (
    <Link
      href={zone.cta.href}
      className="group relative flex flex-col bg-background border border-foreground/8 p-8 md:p-10 transition-all duration-300 hover:border-foreground/15 hover:shadow-[0_24px_48px_-12px_rgba(44,36,32,0.08)] hover:-translate-y-0.5"
      data-cursor="link"
    >
      {/* Accent bar — scales in from left on hover */}
      <div
        className="absolute top-0 left-0 w-1 h-full origin-top scale-y-0 transition-transform duration-500 group-hover:scale-y-100"
        style={{ backgroundColor: zone.color }}
      />

      {/* Icon + Price row */}
      <div className="flex items-start justify-between mb-6">
        <div
          className="flex items-center justify-center w-12 h-12 rounded-full transition-colors duration-300"
          style={{
            color: zone.color,
            backgroundColor: `${zone.color}12`,
          }}
        >
          {service.icon}
        </div>
        <span
          className="text-[10px] tracking-[0.15em] uppercase font-medium px-2.5 py-1 transition-colors duration-300"
          style={{ color: zone.color, backgroundColor: `${zone.color}10` }}
        >
          {service.price}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-display text-xl md:text-2xl font-light tracking-tight text-foreground mb-3 group-hover:text-foreground transition-colors duration-300">
        {service.title}
      </h3>

      {/* Description */}
      <p className="text-sm leading-relaxed text-muted mb-8 flex-1">{service.description}</p>

      {/* CTA */}
      <div className="flex items-center gap-3 text-[10px] tracking-[0.2em] uppercase mt-auto">
        <span className="transition-colors duration-300 text-muted group-hover:text-foreground">
          {service.cta}
        </span>
        <span
          className="h-px transition-all duration-300 w-6 group-hover:w-10 block"
          style={{ backgroundColor: zone.color }}
        />
      </div>
    </Link>
  );
}

export function Services() {
  return (
    <section
      id="services"
      className="relative bg-background pt-32 md:pt-48 pb-48 md:pb-64 px-6 md:px-12"
      aria-label="Services"
    >
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="mb-16 md:mb-20 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
          <div>
            <span className="text-[10px] tracking-[0.35em] uppercase text-muted mb-4 block">
              Services
            </span>
            <h2 className="font-display text-4xl md:text-6xl font-light tracking-tight text-foreground leading-[1.0]">
              Four passions,
              <br />
              one studio.
            </h2>
          </div>
          <p className="text-sm text-muted max-w-[24ch] leading-relaxed md:text-right">
            Each service is a craft in its own right. Built with intention, delivered with care.
          </p>
        </div>

        {/* 2×2 grid — bleeds into the next section via negative margin on parent */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((svc) => (
            <ServiceCard key={svc.zoneId} service={svc} />
          ))}
        </div>

        <div className="mt-14 flex justify-end">
          <Link
            href="/services"
            className="text-[10px] tracking-[0.25em] uppercase text-muted hover:text-foreground transition-colors duration-300 flex items-center gap-3 group"
          >
            View All Services & Pricing
            <span className="w-8 h-px bg-current block transition-all duration-300 group-hover:w-14" />
          </Link>
        </div>
      </div>
    </section>
  );
}
