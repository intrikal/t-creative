/**
 * StudioExperience — Parallax text section describing the in-studio experience.
 *
 * Used on the landing page to convey the physical studio atmosphere.
 * Client Component — uses Framer Motion scroll-linked transforms for a parallax text effect.
 *
 * No props — copy is static brand content.
 */
"use client";

import { useRef } from "react";
import { m, useScroll, useTransform } from "framer-motion";

export function StudioExperience() {
  // useRef anchors this section for scroll measurement.
  const ref = useRef<HTMLDivElement>(null);

  // useScroll tracks section scroll progress (0→1) through the viewport.
  // Cannot run during render because it needs the DOM element ref to measure positions.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // useTransform maps scroll progress to a y offset (40px → -40px), creating
  // a parallax drift where text moves slower than the page scroll.
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <section ref={ref} className="relative bg-surface py-32 md:py-48 px-6 overflow-hidden">
      <div className="mx-auto max-w-3xl text-center">
        <m.p
          className="text-xs tracking-widest uppercase text-muted mb-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          The Studio
        </m.p>

        <m.div style={{ y }}>
          <m.h2
            className="text-3xl md:text-5xl font-light tracking-tight text-foreground leading-tight mb-10"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            Walk in and feel the difference between a space that was decorated and a space that was{" "}
            <em className="font-normal italic">designed</em>.
          </m.h2>

          <m.div
            className="space-y-4 text-lg text-muted leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <p>Warm light. Clean surfaces. Intentional silence.</p>
            <p>
              Every touchpoint — from the booking confirmation to the aftercare message that arrives
              the next morning — has been considered.
            </p>
            <p className="text-foreground font-medium mt-8">
              This is not hospitality. This is care, systematized.
            </p>
          </m.div>
        </m.div>
      </div>
    </section>
  );
}
