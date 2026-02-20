/**
 * Hero — Full-width hero section with headline, tagline, CTAs, and founder photo.
 *
 * Client Component — uses Framer Motion for staggered entrance animations.
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";

export function Hero() {
  return (
    <section className="pt-28 pb-20 md:pt-32 md:pb-28 px-6 overflow-hidden">
      <div className="mx-auto max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
        {/* Text side */}
        <div>
          <motion.span
            className="inline-block text-xs tracking-widest uppercase text-accent mb-8 border border-accent/20 px-4 py-2 rounded-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Premium Beauty &amp; Creative Services
          </motion.span>

          <motion.h1
            className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight text-foreground leading-[1.1] mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
          >
            Where Artistry
            <br />
            Meets <span className="text-accent">Transformation</span>
          </motion.h1>

          <motion.p
            className="text-base text-muted leading-relaxed max-w-lg mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            Premium lash extensions, permanent jewelry, custom crochet commissions, and business
            consulting. Every creation crafted with intention and care, serving San Jose and the Bay
            Area.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45 }}
          >
            <Button href="/contact">Book Appointment</Button>
            <Button variant="secondary" href="#studio">
              Enter the Studio
            </Button>
          </motion.div>

          {/* Quick service links */}
          <motion.div
            className="flex flex-wrap gap-3 mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            {[
              { label: "Lash Extensions", href: "/services" },
              { label: "Permanent Jewelry", href: "/services" },
              { label: "Crochet", href: "/services" },
            ].map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="text-xs tracking-wide text-muted hover:text-foreground border border-foreground/10 hover:border-foreground/25 px-4 py-2 transition-colors duration-200"
              >
                {s.label}
              </Link>
            ))}
          </motion.div>
        </div>

        {/* Photo side */}
        <motion.div
          className="flex justify-center md:justify-end"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
        >
          <div className="w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden shadow-xl">
            <Image
              src="/images/trini.jpg"
              alt="Trini Lam — founder of T Creative Studio"
              width={320}
              height={320}
              className="object-cover w-full h-full"
              priority
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
