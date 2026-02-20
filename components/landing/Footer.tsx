/**
 * Footer — Site-wide footer with brand info, navigation columns, and social links.
 *
 * Client Component — uses Framer Motion for fade-in on scroll.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { socials } from "@/lib/socials";

const columns = [
  {
    title: "Services",
    links: [
      { label: "Lash Extensions", href: "/services" },
      { label: "Permanent Jewelry", href: "/services" },
      { label: "Custom Crochet", href: "/services" },
      { label: "Consulting", href: "/consulting" },
    ],
  },
  {
    title: "Studio",
    links: [
      { label: "Portfolio", href: "/portfolio" },
      { label: "Training", href: "/training" },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export function Footer() {
  return (
    <motion.footer
      className="py-16 md:py-24 px-6 border-t border-foreground/5"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12 md:gap-8 mb-16">
          {/* Brand */}
          <div className="md:col-span-2">
            <p className="text-sm font-medium tracking-wide text-foreground mb-3">
              T Creative Studio
            </p>
            <p className="text-sm text-muted leading-relaxed max-w-sm mb-4">
              Premium lash extensions, permanent jewelry, custom crochet, and business consulting.
              Crafted with intention and care in San Jose.
            </p>
            <p className="text-sm text-muted mb-6">hello@tcreativestudio.com</p>
            {/* Social icons row */}
            <div className="flex gap-3">
              {socials.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 flex items-center justify-center text-muted hover:text-foreground border border-foreground/10 hover:border-foreground/25 transition-colors duration-200"
                    aria-label={s.label}
                    title={`${s.label} — ${s.description}`}
                  >
                    <Icon size={14} />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-xs tracking-widest uppercase text-foreground mb-4">{col.title}</p>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted hover:text-foreground transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-foreground/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted">
            &copy; {new Date().getFullYear()} T Creative Studio. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-xs text-muted hover:text-muted transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-xs text-muted hover:text-muted transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
