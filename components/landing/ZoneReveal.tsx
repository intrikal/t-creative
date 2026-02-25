/**
 * ZoneReveal — Four business verticals as full-bleed editorial bands. Act IV.
 *
 * Each vertical gets a ~90vh horizontal band. Colour bleeds to the edge on
 * one side (no gutter); copy occupies the other side. Bands alternate
 * left/right for visual rhythm.
 *
 * Each band reveals on scroll with a whileInView entrance. The large verb
 * ("Elevate.", "Weld.", "Create.", "Transform.") anchors the brand language
 * defined in the design system — parallel grammar, equal weight.
 *
 * Includes an animated stat counter per band that counts up on viewport entry.
 *
 * Client Component — Framer Motion scroll-reveal animations.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { ZONES, type ZoneId } from "@/lib/zones";

interface ZoneBand {
  id: ZoneId;
  verb: string;
  /** Which side the colour panel is on */
  side: "left" | "right";
  /** Stat to display as animated counter */
  stat: { value: number; prefix?: string; suffix: string; label: string };
}

const BANDS: ZoneBand[] = [
  {
    id: "lash",
    verb: "Elevate.",
    side: "left",
    stat: { value: 500, suffix: "+", label: "lash sets completed" },
  },
  {
    id: "jewelry",
    verb: "Weld.",
    side: "right",
    stat: { value: 1000, suffix: "+", label: "chains welded" },
  },
  {
    id: "crochet",
    verb: "Create.",
    side: "left",
    stat: { value: 200, suffix: "+", label: "custom commissions" },
  },
  {
    id: "consulting",
    verb: "Transform.",
    side: "right",
    stat: { value: 50, suffix: "+", label: "businesses transformed" },
  },
];

/** Animated number counter that counts up when in view */
function AnimatedCounter({
  value,
  suffix = "",
  label,
}: {
  value: number;
  suffix?: string;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 50, damping: 30 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (isInView) {
      motionVal.set(value);
    }
  }, [isInView, motionVal, value]);

  useEffect(() => {
    const unsubscribe = spring.on("change", (v) => {
      setDisplay(Math.round(v));
    });
    return unsubscribe;
  }, [spring]);

  return (
    <div ref={ref} className="mt-10 pt-6 border-t border-foreground/8">
      <span className="text-2xl md:text-3xl font-light text-foreground tabular-nums">
        {display.toLocaleString()}
        {suffix}
      </span>
      <span className="block text-[10px] tracking-[0.2em] uppercase text-muted mt-1">{label}</span>
    </div>
  );
}

function ZoneBandSection({ band }: { band: ZoneBand }) {
  const zone = ZONES[band.id];
  const isLeft = band.side === "left";

  return (
    <motion.div
      className="flex flex-col md:flex-row min-h-[90vh] overflow-hidden"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
    >
      {/* Colour panel */}
      <motion.div
        className={`w-full md:w-[45%] flex items-end justify-start p-10 md:p-16 min-h-[40vh] md:min-h-full order-1 ${
          isLeft ? "md:order-1" : "md:order-2"
        }`}
        style={{ backgroundColor: zone.color }}
        initial={{ x: isLeft ? -40 : 40 }}
        whileInView={{ x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Big verb — display serif, bottom-left of the colour panel */}
        <p
          className="font-display text-[56px] sm:text-[72px] md:text-[88px] lg:text-[104px] font-light leading-none text-white/90 tracking-[0.02em] select-none"
          aria-hidden
        >
          {band.verb}
        </p>
      </motion.div>

      {/* Copy panel */}
      <motion.div
        className={`w-full md:w-[55%] flex flex-col justify-center px-8 md:px-16 lg:px-24 py-16 md:py-0 bg-background order-2 ${
          isLeft ? "md:order-2" : "md:order-1"
        }`}
        initial={{ x: isLeft ? 40 : -40, opacity: 0 }}
        whileInView={{ x: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        <span
          className="text-[10px] tracking-[0.3em] uppercase mb-4 block"
          style={{ color: zone.color }}
        >
          {zone.label}
        </span>

        <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-light tracking-tight text-foreground mb-6 leading-[1.15]">
          {zone.heading}
        </h2>

        <p className="text-sm text-muted leading-relaxed max-w-md mb-4">{zone.subtitle}</p>

        <p className="text-sm text-muted leading-relaxed max-w-md mb-10">{zone.description}</p>

        <Link
          href={zone.cta.href}
          className="inline-flex items-center gap-3 text-xs tracking-[0.2em] uppercase text-foreground group w-fit"
        >
          <span className="nav-link-reveal pb-px">{zone.cta.label}</span>
          <motion.span
            className="text-base"
            initial={{ x: 0 }}
            whileHover={{ x: 4 }}
            transition={{ duration: 0.2 }}
          >
            →
          </motion.span>
        </Link>

        {/* Animated stat counter */}
        <AnimatedCounter
          value={band.stat.value}
          suffix={band.stat.suffix}
          label={band.stat.label}
        />
      </motion.div>
    </motion.div>
  );
}

export function ZoneReveal() {
  return (
    <section aria-label="Services" className="overflow-hidden">
      {BANDS.map((band) => (
        <ZoneBandSection key={band.id} band={band} />
      ))}
    </section>
  );
}
