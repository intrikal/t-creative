/**
 * ServicesPage — Full service catalog with category anchor nav, GSAP animations,
 * shadcn components, and PostHog CTA tracking.
 */
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Search, X } from "lucide-react";
import posthog from "posthog-js";
import { Footer } from "@/components/landing/Footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { PublicService } from "./actions";

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------ */
/*  Category display config                                            */
/* ------------------------------------------------------------------ */

const CATEGORY_META: Record<string, { label: string; color: string; slug: string; note?: string }> =
  {
    lash: { label: "Lash Extensions", color: "#C4907A", slug: "lash" },
    jewelry: {
      label: "Permanent Jewelry",
      color: "#D4A574",
      slug: "jewelry",
      note: "All chains are 14k gold-filled, nickel-free, and waterproof. No clasp — welded on-site.",
    },
    crochet: { label: "Custom Crochet Crafts", color: "#9BB8B8", slug: "crochet" },
    consulting: {
      label: "Business Consulting",
      color: "#5B8A8A",
      slug: "consulting",
      note: "All consulting services are available remotely. Contact for scheduling and quote.",
    },
    "3d_printing": { label: "3D Printing", color: "#8B7DAF", slug: "3d-printing" },
    aesthetics: { label: "Aesthetics", color: "#B8927A", slug: "aesthetics" },
  };

const CATEGORY_ORDER = ["lash", "jewelry", "crochet", "consulting", "3d_printing", "aesthetics"];

/* ------------------------------------------------------------------ */
/*  Price formatting                                                   */
/* ------------------------------------------------------------------ */

function formatCents(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

function formatPrice(service: PublicService): string {
  const { priceInCents, priceMinInCents, priceMaxInCents } = service;
  if (priceMinInCents != null && priceMaxInCents != null) {
    return `${formatCents(priceMinInCents)}–${formatCents(priceMaxInCents)}`;
  }
  if (priceMinInCents != null) return `From ${formatCents(priceMinInCents)}`;
  if (priceInCents != null) {
    if (priceInCents === 0) return "Free";
    return formatCents(priceInCents);
  }
  return "Quote";
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "";
  return `${minutes} min`;
}

/* ------------------------------------------------------------------ */
/*  Hardcoded fallback                                                 */
/* ------------------------------------------------------------------ */

type ServiceCategory = {
  name: string;
  slug: string;
  color: string;
  note?: string;
  services: { name: string; description: string; price: string; duration: string }[];
};

const FALLBACK_CATEGORIES: ServiceCategory[] = [
  {
    name: "Lash Extensions",
    slug: "lash",
    color: "#C4907A",
    services: [
      {
        name: "Classic Lash Set",
        description:
          "Natural, elegant one-to-one lash extensions for everyday wear. Open-eye or cat-eye mapping available.",
        price: "$150",
        duration: "120 min",
      },
      {
        name: "Hybrid Lash Set",
        description:
          "The perfect balance between classic and volume — added texture with a natural base.",
        price: "$175",
        duration: "150 min",
      },
      {
        name: "Volume Lash Set",
        description: "Dramatic, full lashes using 2D–4D handmade fans for maximum impact.",
        price: "$200",
        duration: "180 min",
      },
      {
        name: "Mega Volume Lash Set",
        description:
          "Ultra-dramatic mega volume with 6–8 extensions per natural lash. For the boldest look.",
        price: "$250",
        duration: "240 min",
      },
      {
        name: "Wispy Lash Set",
        description: "Spiky, fluttery texture layered over a classic base — effortlessly undone.",
        price: "$180",
        duration: "150 min",
      },
      {
        name: "Cat Eye Lash Set",
        description: "Dramatic lifted outer corners for an elongated, sultry effect.",
        price: "$200",
        duration: "180 min",
      },
      {
        name: "Doll Eye Lash Set",
        description: "Round, wide-eyed look with length concentrated in the center.",
        price: "$200",
        duration: "180 min",
      },
      {
        name: "Lash Fill",
        description: "Maintain your extensions with a fill. Recommended every 2–3 weeks.",
        price: "$65",
        duration: "75 min",
      },
      {
        name: "Lash Extension Removal",
        description:
          "Professional, safe removal using a dissolving agent — no damage to natural lashes.",
        price: "$40",
        duration: "45 min",
      },
    ],
  },
  {
    name: "Permanent Jewelry",
    slug: "jewelry",
    color: "#D4A574",
    note: "All chains are 14k gold-filled, nickel-free, and waterproof. No clasp — welded on-site.",
    services: [
      {
        name: "Permanent Bracelet",
        description:
          "A bracelet that becomes part of your story. Choose your chain style and length.",
        price: "From $55",
        duration: "30 min",
      },
      {
        name: "Permanent Necklace",
        description: "Elegant permanent necklace in box or rope chain — mark a moment that stays.",
        price: "From $75",
        duration: "30 min",
      },
      {
        name: "Permanent Anklet",
        description: "Delicate permanent anklet, custom-fit to your ankle.",
        price: "From $60",
        duration: "25 min",
      },
      {
        name: "Permanent Ring",
        description: "Delicate layering ring — minimalist and waterproof.",
        price: "From $55",
        duration: "25 min",
      },
      {
        name: "Matching Set (Bracelet + Anklet)",
        description: "Coordinating bracelet and anklet in the same chain — welded in one session.",
        price: "From $110",
        duration: "50 min",
      },
      {
        name: "Bracelet with Charm",
        description: "Permanent bracelet featuring a custom charm — add a meaningful detail.",
        price: "From $85",
        duration: "35 min",
      },
    ],
  },
  {
    name: "Custom Crochet Crafts",
    slug: "crochet",
    color: "#9BB8B8",
    services: [
      {
        name: "Custom Crochet Piece",
        description:
          "Handcrafted crochet pieces made just for you — describe your vision and we'll quote it.",
        price: "Quote",
        duration: "",
      },
      {
        name: "Custom Crochet Cardigan",
        description: "Handcrafted cardigan made to your measurements and color preferences.",
        price: "Quote",
        duration: "",
      },
      {
        name: "Crochet Amigurumi",
        description: "Adorable handcrafted characters and animals — great for gifts.",
        price: "$35–$150",
        duration: "",
      },
      {
        name: "Crochet Plant Hangers",
        description: "Boho-style plant hangers in various sizes and colors.",
        price: "$25–$60",
        duration: "",
      },
      {
        name: "Custom Crochet Scarf",
        description: "Textured scarves in various patterns and fibers.",
        price: "$45–$120",
        duration: "",
      },
      {
        name: "Custom Crochet Hat",
        description: "Handcrafted hats and beanies — fitted to your head size.",
        price: "$35–$85",
        duration: "",
      },
    ],
  },
  {
    name: "Business Consulting",
    slug: "consulting",
    color: "#5B8A8A",
    note: "All consulting services are available remotely. Contact for scheduling and quote.",
    services: [
      {
        name: "HR Strategy & Consulting",
        description:
          "Team building, hiring processes, performance frameworks, and HR infrastructure for growing businesses.",
        price: "Quote",
        duration: "",
      },
      {
        name: "Beauty Business Consulting",
        description:
          "Pricing strategy, client systems, service menu design, and scaling your studio — built on real experience.",
        price: "Quote",
        duration: "",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Transform DB → display                                             */
/* ------------------------------------------------------------------ */

function groupByCategory(dbServices: PublicService[]): ServiceCategory[] {
  const grouped = new Map<string, PublicService[]>();
  for (const s of dbServices) {
    const list = grouped.get(s.category) ?? [];
    list.push(s);
    grouped.set(s.category, list);
  }

  return CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((cat) => {
    const meta = CATEGORY_META[cat] ?? { label: cat, color: "#888", slug: cat };
    const items = grouped.get(cat)!;
    return {
      name: meta.label,
      slug: meta.slug,
      color: meta.color,
      note: meta.note,
      services: items.map((s) => ({
        name: s.name,
        description: s.description ?? "",
        price: formatPrice(s),
        duration: formatDuration(s.durationMinutes),
      })),
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ServicesPage({
  services,
  businessName,
  location,
  email,
  footerTagline,
  socialLinks,
}: {
  services: PublicService[];
  businessName?: string;
  location?: string;
  email?: string;
  footerTagline?: string;
  socialLinks?: { platform: string; handle: string; url: string }[];
}) {
  const allCategories: ServiceCategory[] =
    services.length > 0 ? groupByCategory(services) : FALLBACK_CATEGORIES;

  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const query = searchQuery.toLowerCase().trim();

  // Filter categories and services based on dropdown + search
  const filteredCategories = (
    activeFilter ? allCategories.filter((c) => c.slug === activeFilter) : allCategories
  )
    .map((cat) => ({
      ...cat,
      services: query
        ? cat.services.filter(
            (s) =>
              s.name.toLowerCase().includes(query) || s.description.toLowerCase().includes(query),
          )
        : cat.services,
    }))
    .filter((cat) => cat.services.length > 0);

  const totalShown = filteredCategories.reduce((sum, c) => sum + c.services.length, 0);
  const totalAll = allCategories.reduce((sum, c) => sum + c.services.length, 0);
  const isFiltered = activeFilter !== null || query.length > 0;

  const containerRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  // Initial mount animations (hero, toolbar, CTA)
  useGSAP(
    () => {
      if (heroRef.current) {
        gsap.fromTo(
          heroRef.current.children,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: "power3.out" },
        );
      }
      if (toolbarRef.current) {
        gsap.fromTo(
          toolbarRef.current,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.5, delay: 0.3, ease: "power3.out" },
        );
      }
      if (ctaRef.current) {
        gsap.fromTo(
          ctaRef.current,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: { trigger: ctaRef.current, start: "top 85%", once: true },
          },
        );
      }
    },
    { scope: containerRef },
  );

  // Re-animate cards when filter/search changes
  useGSAP(
    () => {
      const sections = containerRef.current?.querySelectorAll("[data-category-section]");
      sections?.forEach((section) => {
        const targets = section.querySelectorAll("[data-animate]");
        if (targets.length === 0) return;
        gsap.fromTo(
          targets,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.4, stagger: 0.03, ease: "power3.out" },
        );
      });
    },
    { scope: containerRef, dependencies: [activeFilter, searchQuery] },
  );

  function trackCta(cta: string, category?: string) {
    posthog.capture("cta_clicked", {
      cta,
      location: "services_page",
      ...(category ? { category } : {}),
    });
  }

  return (
    <>
      <main id="main-content" className="pt-16" ref={containerRef}>
        {/* Hero */}
        <section className="py-20 md:py-24 px-6">
          <div ref={heroRef} className="mx-auto max-w-7xl text-center">
            <span className="text-xs tracking-widest uppercase text-accent mb-6 block opacity-0">
              Our Services
            </span>
            <h1 className="text-4xl md:text-6xl font-light tracking-tight text-foreground mb-6 opacity-0">
              Handcrafted services in San Jose.
            </h1>
            <p className="text-base md:text-lg text-muted max-w-xl mx-auto opacity-0">
              From lash extensions to permanent jewelry, handcrafted pieces, and business consulting
              — every service is crafted with intention and care.
            </p>
          </div>
        </section>

        {/* Search + filter toolbar */}
        <div
          ref={toolbarRef}
          className="sticky top-16 z-40 bg-background/90 backdrop-blur-md border-b border-foreground/5 px-6 py-4 opacity-0"
        >
          <div className="mx-auto max-w-xl flex gap-3">
            {/* Search input */}
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search services..."
                className="w-full pl-10 pr-9 py-2.5 text-sm bg-surface rounded-lg border border-muted/20 outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:border-transparent transition-colors placeholder:text-muted/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Category dropdown */}
            <div className="relative shrink-0">
              <select
                value={activeFilter ?? ""}
                onChange={(e) => setActiveFilter(e.target.value || null)}
                className="w-full sm:w-48 appearance-none px-4 pr-10 py-2.5 text-sm bg-surface rounded-lg border border-muted/20 outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:border-transparent transition-colors"
              >
                <option value="">All Categories</option>
                {allCategories.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 6l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Result count */}
          {isFiltered && (
            <div className="mx-auto max-w-xl mt-2 text-center">
              <span className="text-xs text-muted">
                Showing {totalShown} of {totalAll} services
                {activeFilter && (
                  <>
                    {" "}
                    in{" "}
                    <span className="text-foreground">
                      {allCategories.find((c) => c.slug === activeFilter)?.name}
                    </span>
                  </>
                )}
                {query && (
                  <>
                    {" "}
                    matching &ldquo;
                    <span className="text-foreground">{searchQuery}</span>&rdquo;
                  </>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Empty state */}
        {filteredCategories.length === 0 && (
          <section className="py-20 px-6">
            <div className="mx-auto max-w-7xl text-center">
              <p className="text-muted text-sm mb-4">
                No services found{query ? ` matching "${searchQuery}"` : ""}.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveFilter(null);
                }}
                className="text-xs tracking-wide uppercase text-accent hover:text-foreground transition-colors"
              >
                Clear filters
              </button>
            </div>
          </section>
        )}

        {/* Service categories */}
        {filteredCategories.map((category, ci) => (
          <section
            key={category.slug}
            data-category-section
            className={`py-16 md:py-20 px-6 ${!isFiltered && ci % 2 === 1 ? "bg-surface/50" : ""}`}
          >
            <div className="mx-auto max-w-7xl">
              {/* Category header */}
              <div data-animate className="flex items-start gap-4 mb-10 opacity-0">
                <div
                  className="w-3 h-3 rounded-full mt-2 flex-shrink-0"
                  style={{ backgroundColor: category.color }}
                />
                <div className="flex-1">
                  <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
                    <h2 className="text-2xl md:text-3xl font-light tracking-tight text-foreground">
                      {category.name}
                    </h2>
                    <Badge variant="secondary" className="text-[10px]">
                      {category.services.length} services
                    </Badge>
                  </div>
                  {category.note && <p className="text-xs text-muted max-w-xl">{category.note}</p>}
                </div>
              </div>

              {/* Service cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {category.services.map((service) => (
                  <Card
                    key={service.name}
                    data-animate
                    className="opacity-0 border-muted/15 shadow-none hover:border-muted/30 transition-colors duration-200"
                  >
                    <CardContent className="pt-5 pb-5 flex flex-col gap-3 h-full">
                      <h3 className="text-sm font-medium text-foreground">{service.name}</h3>
                      <p className="text-xs text-muted leading-relaxed flex-1">
                        {service.description}
                      </p>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-accent">{service.price}</span>
                        {service.duration && (
                          <span className="text-xs text-muted">{service.duration}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Per-category inline CTA */}
              <div data-animate className="opacity-0">
                <Link
                  href={`/contact?interest=${encodeURIComponent(category.name)}`}
                  onClick={() => trackCta("category_inquiry", category.name)}
                  className="inline-flex items-center gap-2 text-xs tracking-wide uppercase text-muted hover:text-accent transition-colors"
                >
                  Interested in {category.name.toLowerCase()}? Get in touch
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </section>
        ))}

        {/* Bottom CTA */}
        <section className="py-20 md:py-24 px-6">
          <div
            ref={ctaRef}
            className="mx-auto max-w-7xl rounded-2xl bg-foreground text-background p-10 md:p-14 flex flex-col items-center text-center gap-6 opacity-0"
          >
            <span className="text-xs tracking-widest uppercase text-accent block">
              Ready to Book
            </span>
            <h2 className="text-2xl md:text-3xl font-light tracking-tight max-w-lg">
              Ready to book?
            </h2>
            <p className="text-sm text-background/60 max-w-md">
              New clients, reach out through the contact form. Existing clients can book directly
              through the client portal.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/contact"
                onClick={() => trackCta("new_client_inquiry")}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 text-xs tracking-wide uppercase rounded-full bg-background text-foreground hover:bg-background/90 transition-colors duration-200"
              >
                Get in Touch
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/dashboard/book"
                onClick={() => trackCta("existing_client_book")}
                className="inline-flex items-center justify-center px-8 py-3.5 text-xs tracking-wide uppercase rounded-full border border-background/20 text-background hover:border-background/40 transition-colors duration-200"
              >
                Client Portal
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer
        businessName={businessName}
        location={location}
        email={email}
        tagline={footerTagline}
        socialLinks={socialLinks}
      />
    </>
  );
}
