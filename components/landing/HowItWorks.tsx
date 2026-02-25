/**
 * HowItWorks — Three-step process section. Inserted between ZoneReveal and Portfolio.
 *
 * Reduces friction by showing how simple booking is. Three steps connected
 * by an animated SVG line that draws itself on viewport entry. Each step
 * number scales up with stagger delay.
 *
 * Layout: horizontal on desktop, vertical on mobile.
 *
 * Client Component — Framer Motion useInView + whileInView animations.
 */
"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const STEPS = [
  {
    number: "01",
    title: "Choose",
    description:
      "Browse services, pick what resonates. Lashes, skin, jewelry, craft, or consulting.",
  },
  {
    number: "02",
    title: "Book",
    description: "Select your time. Confirm in seconds. No phone tag.",
  },
  {
    number: "03",
    title: "Arrive",
    description: "Walk in. We handle the rest. Every detail, already considered.",
  },
];

function ConnectorLine({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <svg ref={ref} className={className} viewBox="0 0 100 2" preserveAspectRatio="none" fill="none">
      <motion.line
        x1="0"
        y1="1"
        x2="100"
        y2="1"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeDasharray="100"
        initial={{ strokeDashoffset: 100 }}
        animate={isInView ? { strokeDashoffset: 0 } : { strokeDashoffset: 100 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}

function ConnectorLineVertical({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });

  return (
    <svg ref={ref} className={className} viewBox="0 0 2 40" preserveAspectRatio="none" fill="none">
      <motion.line
        x1="1"
        y1="0"
        x2="1"
        y2="40"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeDasharray="40"
        initial={{ strokeDashoffset: 40 }}
        animate={isInView ? { strokeDashoffset: 0 } : { strokeDashoffset: 40 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}

export function HowItWorks() {
  return (
    <section
      className="bg-background py-32 md:py-48 px-6 overflow-hidden"
      aria-label="How it works"
    >
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <motion.div
          className="text-center mb-20 md:mb-28"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-[10px] tracking-[0.3em] uppercase text-muted mb-5 block">
            How It Works
          </span>
          <h2 className="font-display text-4xl md:text-6xl font-light tracking-tight text-foreground leading-[1.1]">
            Three steps. One studio.
          </h2>
        </motion.div>

        {/* Steps — horizontal on desktop, vertical on mobile */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-0">
          {STEPS.map((step, i) => (
            <div key={step.number} className="contents">
              {/* Step card */}
              <motion.div
                className="flex-1 text-center px-4 md:px-8"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.7, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Number */}
                <motion.span
                  className="font-display text-5xl md:text-6xl font-light text-accent/20 block mb-4"
                  initial={{ scale: 0, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.6,
                    delay: 0.2 + i * 0.15,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  {step.number}
                </motion.span>

                <h3 className="font-display text-2xl md:text-3xl font-light text-foreground mb-3 tracking-tight">
                  {step.title}
                </h3>

                <p className="text-sm text-muted leading-relaxed max-w-[260px] mx-auto">
                  {step.description}
                </p>
              </motion.div>

              {/* Connector line between steps */}
              {i < STEPS.length - 1 && (
                <>
                  {/* Desktop: horizontal line */}
                  <ConnectorLine className="hidden md:block w-16 lg:w-24 text-foreground/15 shrink-0" />
                  {/* Mobile: vertical line */}
                  <ConnectorLineVertical className="md:hidden h-10 w-full text-foreground/15 my-4 mx-auto" />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
