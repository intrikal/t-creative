/**
 * ServicesPage — Client Component rendering the full service catalog with pricing.
 *
 * Displays services grouped by category with scroll-triggered animations.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Footer } from "@/components/landing/Footer";

const categories = [
  {
    name: "Lash Extensions",
    color: "#C4907A",
    services: [
      {
        name: "Classic Lash Set",
        description: "Natural, elegant lash extensions for everyday wear",
        price: "$150",
        duration: "120 min",
      },
      {
        name: "Hybrid Lash Set",
        description: "The perfect balance between classic and volume",
        price: "$175",
        duration: "150 min",
      },
      {
        name: "Volume Lash Set",
        description: "Dramatic, full lashes for maximum impact",
        price: "$200",
        duration: "180 min",
      },
      {
        name: "Mega Volume Lash Set",
        description: "Ultra-dramatic mega volume with 6-8 extensions per natural lash",
        price: "$250",
        duration: "240 min",
      },
      {
        name: "Wispy Lash Set",
        description: "Natural, fluttery lashes with texture and movement",
        price: "$180",
        duration: "150 min",
      },
      {
        name: "Cat Eye Lash Set",
        description: "Dramatic cat eye effect with longer lashes at the outer corners",
        price: "$200",
        duration: "180 min",
      },
      {
        name: "Doll Eye Lash Set",
        description: "Round, wide-eyed look with longer lashes in the center",
        price: "$200",
        duration: "180 min",
      },
      {
        name: "Lash Fill",
        description: "Maintain your lash extensions with a fill",
        price: "$75",
        duration: "60 min",
      },
      {
        name: "Lash Extension Removal",
        description: "Professional, safe removal of lash extensions",
        price: "$40",
        duration: "45 min",
      },
    ],
  },
  {
    name: "Permanent Jewelry",
    color: "#D4A574",
    services: [
      {
        name: "Permanent Bracelet",
        description: "A beautiful bracelet that becomes part of your story",
        price: "$75",
        duration: "30 min",
      },
      {
        name: "Permanent Necklace",
        description: "Elegant permanent necklace to mark special moments",
        price: "$85",
        duration: "30 min",
      },
      {
        name: "Permanent Anklet",
        description: "Delicate permanent anklet for a subtle touch",
        price: "$70",
        duration: "25 min",
      },
      {
        name: "Permanent Ring",
        description: "Delicate permanent ring for minimalist elegance",
        price: "$65",
        duration: "25 min",
      },
      {
        name: "Permanent Bracelet Stack",
        description: "Multiple permanent bracelets layered together",
        price: "$200",
        duration: "60 min",
      },
      {
        name: "Bracelet with Charm",
        description: "Permanent bracelet featuring a custom charm",
        price: "$95",
        duration: "35 min",
      },
    ],
  },
  {
    name: "Custom Crochet",
    color: "#7BA3A3",
    services: [
      {
        name: "Custom Crochet Piece",
        description: "Handcrafted crochet pieces made just for you",
        price: "Quote",
        duration: "",
      },
      {
        name: "Custom Crochet Cardigan",
        description: "Handcrafted crochet cardigan made to your measurements",
        price: "Quote",
        duration: "",
      },
      {
        name: "Crochet Amigurumi",
        description: "Adorable handcrafted crochet characters and animals",
        price: "$35–$150",
        duration: "",
      },
      {
        name: "Crochet Plant Hangers",
        description: "Boho-style crochet plant hangers in various sizes",
        price: "$25–$60",
        duration: "",
      },
      {
        name: "Custom Crochet Scarf",
        description: "Textured crochet scarves in various patterns and colors",
        price: "$45–$120",
        duration: "",
      },
      {
        name: "Custom Crochet Hat",
        description: "Handcrafted crochet hats and beanies",
        price: "$35–$85",
        duration: "",
      },
    ],
  },
  {
    name: "Consulting",
    color: "#5B8A8A",
    services: [
      {
        name: "HR Strategy & Consulting",
        description: "Strategic HR consulting to help build better teams and processes",
        price: "Quote",
        duration: "",
      },
      {
        name: "Business Growth Consulting",
        description: "Strategic business consulting to help your company scale",
        price: "Quote",
        duration: "",
      },
    ],
  },
];

export function ServicesPage() {
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
              From lash extensions to permanent jewelry, crochet commissions, and business
              consulting — every service is crafted with intention and care.
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
                className="flex items-center gap-4 mb-12"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                <h2 className="text-2xl md:text-3xl font-light tracking-tight text-foreground">
                  {category.name}
                </h2>
                <span className="text-xs text-muted ml-auto">
                  {category.services.length} services
                </span>
              </motion.div>

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
              Book your appointment today and experience the artistry.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-8 py-3.5 text-xs tracking-wide uppercase bg-accent text-background hover:bg-accent/80 transition-colors"
            >
              Book Appointment
            </Link>
          </motion.div>
        </section>
      </main>
      <Footer />
    </>
  );
}
