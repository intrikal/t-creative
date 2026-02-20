/**
 * FeatureCard — Scroll-triggered card displaying a service feature.
 *
 * Client Component — uses Framer Motion `whileInView` with staggered delay.
 */
"use client";

import { motion } from "framer-motion";

interface FeatureCardProps {
  title: string;
  description: string;
  index: number;
}

export function FeatureCard({ title, description, index }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: "easeOut" }}
      className="bg-surface p-8 flex flex-col gap-3"
    >
      <h3 className="text-sm font-medium tracking-wide uppercase text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted">{description}</p>
    </motion.div>
  );
}
