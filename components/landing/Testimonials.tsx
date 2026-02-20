/**
 * Testimonials — Displays client reviews with a featured quote and a compact grid.
 *
 * Client Component — uses Framer Motion for scroll-reveal entrance animations.
 */
"use client";

import { motion } from "framer-motion";
import { SectionWrapper } from "@/components/ui/SectionWrapper";

const testimonials = [
  {
    quote:
      "Trini's hybrid lash set is the perfect balance — natural enough for everyday but glamorous enough for special occasions. I get compliments all the time!",
    name: "Nicole W.",
    service: "Hybrid Lash Set",
  },
  {
    quote:
      "The permanent bracelet I got is absolutely perfect. Trini helped me choose the perfect chain and charm, and the whole process was so smooth. I love wearing it every day!",
    name: "Alex T.",
    service: "Permanent Bracelet",
  },
  {
    quote:
      "The custom crochet blanket I commissioned is absolutely beautiful. Trini worked with me every step of the way to create exactly what I envisioned. It's become my favorite piece in my home.",
    name: "Maya K.",
    service: "Custom Crochet",
  },
  {
    quote:
      "I've been getting my lashes done by Trini for over a year and I'm always amazed by her attention to detail. She truly cares about her clients and it shows in her work.",
    name: "Emily R.",
    service: "Lash Fill",
  },
  {
    quote:
      "Got a permanent bracelet to celebrate my graduation and it's the perfect reminder of this milestone. The process was quick and painless, and Trini made me feel so comfortable.",
    name: "Jessica L.",
    service: "Permanent Bracelet",
  },
  {
    quote:
      "I completed the lash training program and it exceeded all my expectations. Trini is an amazing teacher and I felt confident starting my own business after the training.",
    name: "Rachel K.",
    service: "Lash Extension Certification",
  },
];

function Stars() {
  return (
    <div className="flex gap-0.5" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className="text-accent">
          ★
        </span>
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <SectionWrapper id="testimonials" className="py-32 md:py-48 px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div
          className="mb-16 md:mb-24 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-xs tracking-widest uppercase text-muted mb-6 block">
            Testimonials
          </span>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-foreground">
            What clients say.
          </h2>
        </motion.div>

        {/* Featured testimonial */}
        <motion.div
          className="mb-12 bg-surface p-10 md:p-16 text-center relative"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-6xl md:text-8xl text-accent/20 font-serif absolute top-4 left-6 md:top-8 md:left-12 leading-none select-none">
            &ldquo;
          </span>
          <div className="flex justify-center mb-6">
            <Stars />
          </div>
          <blockquote className="text-lg md:text-xl leading-relaxed text-foreground max-w-2xl mx-auto mb-6">
            {testimonials[0].quote}
          </blockquote>
          <p className="text-sm font-medium text-foreground">{testimonials[0].name}</p>
          <p className="text-xs tracking-widest uppercase text-muted mt-1">
            {testimonials[0].service}
          </p>
        </motion.div>

        {/* Rest of testimonials in a compact grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {testimonials.slice(1, 4).map((t, i) => (
            <motion.div
              key={t.name}
              className="border border-foreground/8 p-6 flex flex-col"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className="mb-3">
                <Stars />
              </div>
              <blockquote className="text-sm leading-relaxed text-muted mb-4 flex-1">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <div>
                <p className="text-sm font-medium text-foreground">{t.name}</p>
                <p className="text-xs tracking-widest uppercase text-muted mt-1">{t.service}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
