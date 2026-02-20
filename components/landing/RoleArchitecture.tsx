/**
 * RoleArchitecture — Presents the three platform roles (Admin, Assistant, Client) in a card grid.
 *
 * Client Component — uses Framer Motion scroll-linked opacity and position transforms per card.
 */
"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const roles = [
  {
    name: "Admin",
    description:
      "Full visibility. Client management, financial oversight, scheduling authority, marketplace control, team coordination.",
    detail: "The entire studio — held in one view.",
  },
  {
    name: "Assistant",
    description:
      "Operational clarity without overwhelm. Manage appointments, assist clients, handle day-to-day.",
    detail: "Exactly the access needed, nothing more.",
  },
  {
    name: "Client",
    description:
      "A private, calm space. Book sessions. Browse products. Message your stylist. View invoices. Leave reviews. Track orders.",
    detail: "Everything personal. Nothing cluttered.",
  },
];

export function RoleArchitecture() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  return (
    <section ref={containerRef} className="bg-surface py-32 md:py-48 px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div
          className="mb-16 md:mb-24"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-xs tracking-widest uppercase text-muted mb-6 block">
            Architecture
          </span>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-foreground">
            Three perspectives. One system.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4">
          {roles.map((role, i) => (
            <RoleColumn key={role.name} role={role} index={i} scrollProgress={scrollYProgress} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RoleColumn({
  role,
  index,
  scrollProgress,
}: {
  role: (typeof roles)[number];
  index: number;
  scrollProgress: ReturnType<typeof useScroll>["scrollYProgress"];
}) {
  const start = 0.2 + index * 0.15;
  const end = start + 0.2;
  const opacity = useTransform(scrollProgress, [start, end], [0.35, 1]);
  const y = useTransform(scrollProgress, [start, end], [20, 0]);

  return (
    <motion.div className="bg-background p-8 md:p-10" style={{ opacity, y }}>
      <h3 className="text-2xl font-light tracking-tight text-foreground mb-6">{role.name}</h3>
      <p className="text-sm leading-relaxed text-muted mb-4">{role.description}</p>
      <p className="text-sm font-medium text-foreground">{role.detail}</p>
    </motion.div>
  );
}
