/**
 * RoleArchitecture — Presents the three platform roles (Admin, Assistant, Client) in a card grid.
 *
 * Used on the landing page to explain the platform's multi-role architecture.
 * Client Component — uses Framer Motion scroll-linked opacity and position transforms per card.
 *
 * No props — role definitions are static brand copy.
 */
"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

// Three platform roles — each describes a perspective within the system.
// Array structure enables .map() with index-based scroll stagger in RoleColumn.
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
  // useRef tracks the section element for Framer Motion's scroll measurement.
  const containerRef = useRef<HTMLDivElement>(null);

  // useScroll provides 0→1 progress as the section scrolls through the viewport.
  // Passed down to each RoleColumn so cards can stagger their reveal based on scroll position.
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
          {/* .map() renders each role as a RoleColumn with its index for scroll stagger.
              Array-driven to keep the stagger offset calculation (0.2 + index * 0.15) consistent. */}
          {roles.map((role, i) => (
            <RoleColumn key={role.name} role={role} index={i} scrollProgress={scrollYProgress} />
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * RoleColumn — A single role card whose opacity and y-position are driven by parent scroll progress.
 *
 * Props:
 * - role: the role data object (name, description, detail) from the roles array
 * - index: position in the grid — used to offset the scroll trigger window so cards reveal sequentially
 * - scrollProgress: parent's scrollYProgress MotionValue — shared to avoid duplicate scroll listeners
 */
function RoleColumn({
  role,
  index,
  scrollProgress,
}: {
  role: (typeof roles)[number];
  index: number;
  scrollProgress: ReturnType<typeof useScroll>["scrollYProgress"];
}) {
  // Each card's animation window is offset by its index (0.2 + index * 0.15).
  // This creates a left-to-right reveal as the user scrolls. useTransform converts
  // the parent's scroll progress into per-card opacity and vertical offset.
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
