/**
 * Navbar — Fixed global navigation bar with responsive mobile drawer.
 *
 * Client Component — uses useState for mobile menu and usePathname for aria-current.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { label: "Services", href: "/services" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Training", href: "/training" },
  { label: "Consulting", href: "/consulting" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-foreground/5">
      <div className="mx-auto max-w-7xl px-6 flex items-center justify-between h-16">
        {/* Brand */}
        <Link href="/" className="text-sm font-medium tracking-wide text-foreground">
          T Creative Studio
        </Link>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs tracking-wide text-muted hover:text-foreground transition-colors duration-200"
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden lg:flex items-center gap-4">
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-5 py-2 text-xs tracking-wide uppercase bg-foreground text-background hover:bg-muted transition-colors duration-200"
          >
            Book Appointment
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          className="lg:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          <motion.span
            className="block w-5 h-px bg-foreground origin-center"
            animate={mobileOpen ? { rotate: 45, y: 3.5 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.span
            className="block w-5 h-px bg-foreground"
            animate={mobileOpen ? { opacity: 0 } : { opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
          <motion.span
            className="block w-5 h-px bg-foreground origin-center"
            animate={mobileOpen ? { rotate: -45, y: -3.5 } : { rotate: 0, y: 0 }}
            transition={{ duration: 0.2 }}
          />
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="lg:hidden bg-background border-b border-foreground/5"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-6 py-6 flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted hover:text-foreground transition-colors"
                  aria-current={pathname === link.href ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-4 border-t border-foreground/10 flex flex-col gap-3">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center px-5 py-3 text-xs tracking-wide uppercase bg-foreground text-background"
                  onClick={() => setMobileOpen(false)}
                >
                  Book Appointment
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
