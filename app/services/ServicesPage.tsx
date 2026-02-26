/**
 * ServicesPage — Full service catalog, driven by database with hardcoded fallback.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Footer } from "@/components/landing/Footer";
import type { PublicService } from "./actions";

/* ------------------------------------------------------------------ */
/*  Category display config                                            */
/* ------------------------------------------------------------------ */

const CATEGORY_META: Record<string, { label: string; color: string; note?: string }> = {
  lash: { label: "Lash Extensions", color: "#C4907A" },
  jewelry: {
    label: "Permanent Jewelry",
    color: "#D4A574",
    note: "All chains are 14k gold-filled, nickel-free, and waterproof. No clasp — welded on-site.",
  },
  crochet: { label: "Custom Crochet Crafts", color: "#9BB8B8" },
  consulting: {
    label: "Business Consulting",
    color: "#5B8A8A",
    note: "All consulting services are available remotely. Contact for scheduling and quote.",
  },
  "3d_printing": { label: "3D Printing", color: "#8B7DAF" },
  aesthetics: { label: "Aesthetics", color: "#B8927A" },
};

/** Display order for categories on the public page. */
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
  if (priceMinInCents != null) {
    return `From ${formatCents(priceMinInCents)}`;
  }
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
/*  Hardcoded fallback (shown when DB is empty)                        */
/* ------------------------------------------------------------------ */

const FALLBACK_CATEGORIES = [
  {
    name: "Lash Extensions",
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
/*  Component                                                          */
/* ------------------------------------------------------------------ */

type ServiceCategory = {
  name: string;
  color: string;
  note?: string;
  services: { name: string; description: string; price: string; duration: string }[];
};

function groupByCategory(dbServices: PublicService[]): ServiceCategory[] {
  const grouped = new Map<string, PublicService[]>();

  for (const s of dbServices) {
    const list = grouped.get(s.category) ?? [];
    list.push(s);
    grouped.set(s.category, list);
  }

  return CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((cat) => {
    const meta = CATEGORY_META[cat] ?? { label: cat, color: "#888" };
    const items = grouped.get(cat)!;
    return {
      name: meta.label,
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

export function ServicesPage({ services }: { services: PublicService[] }) {
  const categories: ServiceCategory[] =
    services.length > 0 ? groupByCategory(services) : FALLBACK_CATEGORIES;

  return (
    <>
      <main id="main-content" className="pt-16">
        {/* Hero */}
        <section className="py-24 md:py-32 px-6">
          <div className="mx-auto max-w-5xl text-center">
            <motion.span
              className="text-xs tracking-widest uppercase text-muted mb-6 block"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Our Services
            </motion.span>
            <motion.h1
              className="text-4xl md:text-6xl font-light tracking-tight text-foreground mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Handcrafted services in San Jose.
            </motion.h1>
            <motion.p
              className="text-base md:text-lg text-muted max-w-xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              From lash extensions to permanent jewelry, handcrafted pieces, and business consulting
              — every service is crafted with intention and care.
            </motion.p>
          </div>
        </section>

        {/* Service categories */}
        {categories.map((category, ci) => (
          <section
            key={category.name}
            className={`py-16 md:py-24 px-6 ${ci % 2 === 1 ? "bg-surface" : ""}`}
          >
            <div className="mx-auto max-w-5xl">
              <motion.div
                className="flex items-start gap-4 mb-4"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div
                  className="w-3 h-3 rounded-full mt-2 flex-shrink-0"
                  style={{ backgroundColor: category.color }}
                />
                <div className="flex-1">
                  <div className="flex items-baseline justify-between flex-wrap gap-2 mb-2">
                    <h2 className="text-2xl md:text-3xl font-light tracking-tight text-foreground">
                      {category.name}
                    </h2>
                    <span className="text-xs text-muted">{category.services.length} services</span>
                  </div>
                  {category.note && (
                    <p className="text-xs text-muted mb-8 max-w-xl">{category.note}</p>
                  )}
                </div>
              </motion.div>

              {!category.note && <div className="mb-12" />}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.services.map((service, i) => (
                  <motion.div
                    key={service.name}
                    className="border border-foreground/8 p-6 flex flex-col gap-3 hover:border-foreground/20 transition-colors duration-200"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                  >
                    <h3 className="text-sm font-medium text-foreground">{service.name}</h3>
                    <p className="text-xs text-muted leading-relaxed flex-1">
                      {service.description}
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-foreground/5">
                      <span className="text-sm font-medium text-accent">{service.price}</span>
                      {service.duration && (
                        <span className="text-xs text-muted">{service.duration}</span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        ))}

        {/* CTA */}
        <section className="py-24 md:py-32 px-6 bg-foreground text-background text-center">
          <motion.div
            className="mx-auto max-w-xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-6">Ready to book?</h2>
            <p className="text-background/60 mb-8">
              Existing clients can book directly through the client portal. New clients, reach out
              through the contact form.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/dashboard/book"
                className="inline-flex items-center justify-center px-8 py-3.5 text-xs tracking-wide uppercase bg-accent text-background hover:bg-accent/80 transition-colors"
              >
                Book via Client Portal
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-3.5 text-xs tracking-wide uppercase border border-background/20 text-background hover:border-background/40 transition-colors"
              >
                New Client Inquiry
              </Link>
            </div>
          </motion.div>
        </section>
      </main>
      <Footer />
    </>
  );
}
