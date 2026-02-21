/**
 * FeaturedProducts — Bestseller product strip on the landing page.
 *
 * Browse without an account. Order CTA links to the public /shop page.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { SectionWrapper } from "@/components/ui/SectionWrapper";

const FEATURED = [
  {
    name: "Lash Aftercare Kit",
    desc: "Oil-free cleanser + spoolie set. Everything you need after your appointment.",
    price: "$18",
    color: "bg-[#c4907a]/10",
    dot: "#c4907a",
  },
  {
    name: "T Creative Lash Cleanser",
    desc: "Private label foam cleanser, 60ml. Gentle on extensions, formulated to protect the bond.",
    price: "$14",
    color: "bg-[#4e6b51]/10",
    dot: "#4e6b51",
  },
  {
    name: "Custom Permanent Jewelry",
    desc: "14k gold-filled chains welded on-site. Bracelets, anklets, necklaces. From $55.",
    price: "From $55",
    color: "bg-[#d4a574]/10",
    dot: "#d4a574",
  },
  {
    name: "T Creative Tote Bag",
    desc: "Heavy canvas tote with TC logo. Limited run — only a few left.",
    price: "$28",
    color: "bg-foreground/[0.04]",
    dot: "#888",
  },
];

export function FeaturedProducts() {
  return (
    <SectionWrapper id="shop" className="py-32 md:py-48 px-6">
      <div className="mx-auto max-w-5xl">
        <motion.div
          className="mb-16 md:mb-20 flex items-end justify-between gap-4 flex-wrap"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div>
            <span className="text-xs tracking-widest uppercase text-muted mb-4 block">Shop</span>
            <h2 className="text-3xl md:text-5xl font-light tracking-tight text-foreground">
              Take the studio home.
            </h2>
            <p className="mt-3 text-muted text-base max-w-md">
              Aftercare products, permanent jewelry, and studio merch — no account needed to browse.
            </p>
          </div>
          <Link
            href="/shop"
            className="text-sm tracking-widest uppercase text-accent hover:text-foreground transition-colors duration-300 border-b border-accent/40 pb-1 shrink-0"
          >
            View All Products
          </Link>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURED.map((product, i) => (
            <motion.div
              key={product.name}
              className="border border-foreground/8 flex flex-col hover:border-foreground/20 transition-colors duration-200"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              {/* Placeholder image */}
              <div
                className={`w-full aspect-square flex items-center justify-center ${product.color}`}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: product.dot }} />
              </div>
              <div className="p-5 flex flex-col gap-2 flex-1">
                <h3 className="text-sm font-medium text-foreground leading-snug">{product.name}</h3>
                <p className="text-xs text-muted leading-relaxed flex-1">{product.desc}</p>
                <div className="flex items-center justify-between pt-3 border-t border-foreground/5 mt-1">
                  <span className="text-sm font-medium text-accent">{product.price}</span>
                  <Link
                    href="/shop"
                    className="text-[10px] tracking-widest uppercase text-muted hover:text-foreground transition-colors border border-foreground/15 hover:border-foreground/30 px-2.5 py-1.5"
                  >
                    View
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
