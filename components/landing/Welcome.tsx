/**
 * Welcome — Introduces the founder with a portrait and studio welcome message.
 *
 * Client Component — uses Framer Motion for scroll-triggered entrance animations.
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

export function Welcome() {
  return (
    <section className="bg-foreground text-background py-24 md:py-32 px-6">
      <div className="mx-auto max-w-5xl flex flex-col md:flex-row items-center gap-12 md:gap-20">
        <motion.div
          className="flex-shrink-0"
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="w-56 h-56 md:w-72 md:h-72 rounded-full overflow-hidden ring-4 ring-accent/30 shadow-2xl">
            <Image
              src="/images/trini.jpg"
              alt="Trini Lam — founder of T Creative Studio"
              width={288}
              height={288}
              className="object-cover w-full h-full"
            />
          </div>
        </motion.div>

        <motion.div
          className="text-center md:text-left"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <span className="text-xs tracking-widest uppercase text-accent mb-4 block">
            Meet Trini
          </span>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight mb-6">
            Welcome to the studio.
          </h2>
          <p className="text-base md:text-lg leading-relaxed text-background/70 max-w-lg">
            Premium lash extensions, permanent jewelry, custom crochet, and business consulting —
            every creation crafted with intention and care. Serving San Jose and the Bay Area.
          </p>
          <Link
            href="/services"
            className="inline-block mt-8 text-xs tracking-widest uppercase text-accent hover:text-background transition-colors duration-300 border-b border-accent/40 pb-1"
          >
            Explore Services
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
