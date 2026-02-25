/**
 * PublicShopPage — Browse products without an account.
 * Order CTA: logged-in clients → /client/shop; new visitors → /contact pre-filled.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Footer } from "@/components/landing/Footer";

type ProductCategory = "aftercare" | "jewelry" | "crochet" | "merch";

interface PublicProduct {
  id: number;
  name: string;
  category: ProductCategory;
  description: string;
  price: string;
  inStock: boolean;
  note?: string;
  color: string;
  dot: string;
}

const PRODUCTS: PublicProduct[] = [
  {
    id: 1,
    name: "Lash Aftercare Kit",
    category: "aftercare",
    description:
      "Includes a 60ml oil-free lash foam cleanser, 5 disposable spoolies, and a printed aftercare card. Designed to extend the life of your extensions. Recommended for all new lash clients.",
    price: "$18",
    inStock: true,
    color: "bg-[#c4907a]/10",
    dot: "#c4907a",
  },
  {
    id: 2,
    name: "T Creative Lash Cleanser",
    category: "aftercare",
    description:
      "Private label foaming cleanser formulated for lash extensions. Removes makeup and oil without weakening the adhesive bond. Fragrance-free, 60ml — approximately 60 uses.",
    price: "$14",
    inStock: true,
    color: "bg-[#4e6b51]/10",
    dot: "#4e6b51",
  },
  {
    id: 3,
    name: "Lash Spoolie Set (5pk)",
    category: "aftercare",
    description:
      "5 disposable mascara wands — the exact style used in the studio. Use one per brushing session to keep lashes looking fresh.",
    price: "$5",
    inStock: false,
    note: "Currently out of stock — check back soon.",
    color: "bg-[#4e6b51]/8",
    dot: "#4e6b51",
  },
  {
    id: 4,
    name: "Custom Permanent Jewelry",
    category: "jewelry",
    description:
      "Choose your chain style and length — bracelets, anklets, or necklaces. 14k gold-filled, nickel-free, and waterproof. Welded on-site at the studio. Booking required.",
    price: "From $55",
    inStock: true,
    note: "This is a service booked at the studio, not a shipped product.",
    color: "bg-[#d4a574]/10",
    dot: "#d4a574",
  },
  {
    id: 5,
    name: "Jewelry Matching Set",
    category: "jewelry",
    description:
      "Coordinating bracelet and anklet in the same chain style, welded on-site in one session. 14k gold-filled. The perfect gift for yourself or someone special.",
    price: "From $110",
    inStock: true,
    note: "Appointment required — book via the client portal.",
    color: "bg-[#d4a574]/12",
    dot: "#a07040",
  },
  {
    id: 6,
    name: "T Creative Tote Bag",
    category: "merch",
    description:
      "Heavy-duty canvas tote in natural with the T Creative logo screen printed in muted black. 15″ × 16″ with 5″ gusset. Limited run.",
    price: "$28",
    inStock: true,
    note: "Limited stock — once gone, gone.",
    color: "bg-foreground/[0.04]",
    dot: "#888",
  },
];

const CAT_LABELS: Record<ProductCategory, string> = {
  aftercare: "Aftercare",
  jewelry: "Jewelry",
  crochet: "Crochet",
  merch: "Merch",
};

export function PublicShopPage() {
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
              Shop
            </motion.span>
            <motion.h1
              className="text-4xl md:text-6xl font-light tracking-tight text-foreground mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Take the studio home.
            </motion.h1>
            <motion.p
              className="text-base md:text-lg text-muted max-w-xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Aftercare products, permanent jewelry bookings, and studio merch. Browse below — no
              account needed.
            </motion.p>
          </div>
        </section>

        {/* Products */}
        <section className="pb-24 px-6">
          <div className="mx-auto max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {PRODUCTS.map((product, i) => (
                <motion.div
                  key={product.id}
                  className={`border border-foreground/8 flex flex-col ${!product.inStock ? "opacity-60" : ""}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.07 }}
                >
                  {/* Placeholder image */}
                  <div
                    className={`w-full aspect-[4/3] flex items-center justify-center ${product.color}`}
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: product.dot }}
                    />
                  </div>

                  <div className="p-6 flex flex-col gap-3 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-medium text-foreground leading-snug">
                        {product.name}
                      </h3>
                      <span className="text-[10px] tracking-wide uppercase text-muted bg-surface border border-foreground/8 px-2 py-0.5 shrink-0">
                        {CAT_LABELS[product.category]}
                      </span>
                    </div>

                    <p className="text-xs text-muted leading-relaxed flex-1">
                      {product.description}
                    </p>

                    {product.note && (
                      <p className="text-[11px] text-muted/70 italic">{product.note}</p>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-foreground/5 mt-auto gap-3">
                      <span className="text-sm font-medium text-accent">{product.price}</span>
                      {!product.inStock ? (
                        <span className="text-xs text-muted">Out of stock</span>
                      ) : product.category === "jewelry" ? (
                        <Link
                          href="/dashboard/book"
                          className="text-[10px] tracking-widest uppercase text-foreground hover:text-accent transition-colors border border-foreground/20 hover:border-accent/40 px-3 py-2"
                        >
                          Book Appointment
                        </Link>
                      ) : (
                        <Link
                          href={`/contact?interest=Shop+Products&product=${encodeURIComponent(product.name)}`}
                          className="text-[10px] tracking-widest uppercase text-foreground hover:text-accent transition-colors border border-foreground/20 hover:border-accent/40 px-3 py-2"
                        >
                          Order
                        </Link>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Client portal CTA */}
        <section className="py-24 px-6 bg-surface border-t border-foreground/8">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-xs tracking-widest uppercase text-muted mb-4">Client Portal</p>
              <h2 className="text-2xl md:text-3xl font-light tracking-tight text-foreground mb-4">
                Already a client?
              </h2>
              <p className="text-sm text-muted mb-8 max-w-md mx-auto">
                Log in to your client portal to add products to your cart, track orders, and pick
                them up at your next appointment.
              </p>
              <Link
                href="/dashboard/shop"
                className="inline-flex items-center justify-center px-8 py-3.5 text-xs tracking-wide uppercase bg-foreground text-background hover:bg-muted transition-colors"
              >
                Shop via Client Portal
              </Link>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
