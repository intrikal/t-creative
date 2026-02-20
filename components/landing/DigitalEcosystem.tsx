/**
 * DigitalEcosystem — Four-quadrant feature grid showcasing booking, portal, messaging, and marketplace.
 *
 * Client Component — uses Framer Motion for staggered scroll-reveal of each feature tile.
 */
"use client";

import { motion } from "framer-motion";
import { SectionWrapper } from "@/components/ui/SectionWrapper";

const features = [
  {
    title: "Booking",
    description: "Schedule appointments without friction.",
    icon: "→",
  },
  {
    title: "Client Portal",
    description: "Sessions, orders, invoices — all in one place.",
    icon: "◎",
  },
  {
    title: "Messaging",
    description: "Direct, private communication.",
    icon: "◈",
  },
  {
    title: "Marketplace",
    description: "Products and custom orders, integrated.",
    icon: "◇",
  },
];

export function DigitalEcosystem() {
  return (
    <SectionWrapper id="ecosystem" className="py-32 md:py-48 px-6">
      <div className="mx-auto max-w-5xl">
        <motion.div
          className="mb-16 md:mb-20 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-xs tracking-widest uppercase text-muted mb-6 block">
            The Ecosystem
          </span>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-foreground leading-tight">
            Everything in one place.
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-foreground/10">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="p-8 md:p-10 text-center border-r border-b border-foreground/10 last:border-r-0 [&:nth-child(2)]:border-r-0 md:[&:nth-child(2)]:border-r [&:nth-child(3)]:border-b-0 [&:nth-child(4)]:border-b-0 md:[&:nth-child(1)]:border-b-0 md:[&:nth-child(2)]:border-b-0"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <span className="text-2xl text-accent mb-4 block">{feature.icon}</span>
              <h3 className="text-sm font-medium tracking-wide uppercase text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-xs leading-relaxed text-muted">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
