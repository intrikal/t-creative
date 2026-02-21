/**
 * Navbar — Fixed global navigation bar with a responsive mobile drawer.
 *
 * ## Why "use client"?
 * This component needs two browser-only features:
 * 1. `useState` to track whether the mobile menu is open or closed.
 * 2. `usePathname` to read the current URL path so we can highlight the active link.
 * Server components can't use either, so we mark this as a Client Component.
 *
 * ## Props
 * `user` is passed down from NavbarWrapper (a Server Component that fetches auth
 * state on the server). This component itself never calls the database or auth
 * APIs — it just receives data and renders it.
 *
 * ## Layout overview
 * - On large screens (lg+): brand left | nav links center | auth/CTA right
 * - On small screens (< lg): brand left | hamburger button right → slide-down drawer
 *
 * ## Animations
 * Uses Framer Motion for two animation targets:
 * - The hamburger icon morphs into an "×" when the menu opens (3 bars → 2 angled lines).
 * - The mobile drawer slides in/out with height + opacity.
 * `AnimatePresence` is required to animate elements as they are removed from the DOM
 * (the "exit" animation), not just when they mount.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

/** All top-level navigation destinations. Update this array to add/remove links. */
const navLinks = [
  { label: "Services", href: "/services" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Shop", href: "/shop" },
  { label: "Training", href: "/training" },
  { label: "Consulting", href: "/consulting" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

type NavbarProps = {
  /**
   * The currently signed-in user, or null if not logged in.
   * - `name`: display name shown in the nav (falls back to email if no firstName).
   * - `avatarUrl`: optional profile image (not yet rendered, reserved for future use).
   */
  user?: { name: string; avatarUrl?: string } | null;
};

export function Navbar({ user = null }: NavbarProps) {
  /** Controls whether the mobile drawer is visible. Toggled by the hamburger button. */
  const [mobileOpen, setMobileOpen] = useState(false);

  /**
   * The current URL path (e.g. "/services").
   * Used to set `aria-current="page"` on the active nav link, which is important
   * for screen readers and also available as a CSS target for active-link styling.
   */
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-foreground/5">
      <div className="mx-auto max-w-7xl px-6 flex items-center justify-between h-16">
        {/* Brand — always visible, links back to home */}
        <Link href="/" className="text-sm font-medium tracking-wide text-foreground">
          T Creative Studio
        </Link>

        {/* Desktop links — hidden on mobile (< lg), visible on large screens */}
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs tracking-wide text-muted hover:text-foreground transition-colors duration-200"
              // aria-current="page" tells screen readers which link is the current page
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA + auth — hidden on mobile */}
        <div className="hidden lg:flex items-center gap-4">
          {user ? (
            // Logged-in state: show the user's name and a sign-out button
            <>
              <span className="text-xs text-muted">{user.name}</span>
              {/*
               * Sign out uses a native HTML form POST to /auth/signout.
               * This avoids client-side JS for the sign-out action and works even
               * if JavaScript is disabled, improving reliability.
               */}
              <form action="/auth/signout" method="POST">
                <button
                  type="submit"
                  className="text-xs tracking-wide text-muted hover:text-foreground transition-colors duration-200"
                >
                  Sign Out
                </button>
              </form>
            </>
          ) : (
            // Logged-out state: show a "Client Portal" link
            <Link
              href="/client"
              className="text-xs tracking-wide text-muted hover:text-foreground transition-colors duration-200"
            >
              Sign In
            </Link>
          )}
          {/* Primary CTA — always visible regardless of auth state */}
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-5 py-2 text-xs tracking-wide uppercase bg-foreground text-background hover:bg-muted transition-colors duration-200"
          >
            Book Appointment
          </Link>
        </div>

        {/*
         * Mobile hamburger button — only visible on small screens (< lg).
         *
         * The three <motion.span> elements are the three bars of the hamburger icon.
         * When `mobileOpen` is true, they animate into an "×":
         * - Top bar:    rotates +45° and moves down  → forms the top-left to bottom-right stroke
         * - Middle bar: fades out (opacity 0)         → disappears entirely
         * - Bottom bar: rotates -45° and moves up     → forms the top-right to bottom-left stroke
         */}
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

      {/*
       * Mobile drawer — slides down from the navbar when the hamburger is open.
       *
       * `AnimatePresence` wraps the conditional block so Framer Motion can play
       * the `exit` animation (height → 0, opacity → 0) before the element is
       * removed from the DOM. Without it, the element would just disappear instantly.
       *
       * Clicking any mobile link closes the drawer via `onClick={() => setMobileOpen(false)}`.
       */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="lg:hidden bg-background border-b border-foreground/5"
            initial={{ height: 0, opacity: 0 }} // starts collapsed and invisible
            animate={{ height: "auto", opacity: 1 }} // expands to natural height
            exit={{ height: 0, opacity: 0 }} // collapses back when closed
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
              {/* Auth and CTA section, visually separated by a top border */}
              <div className="pt-4 border-t border-foreground/10 flex flex-col gap-3">
                {user ? (
                  <form action="/auth/signout" method="POST">
                    <button
                      type="submit"
                      className="w-full text-left text-sm text-muted hover:text-foreground transition-colors"
                    >
                      Sign Out ({user.name})
                    </button>
                  </form>
                ) : (
                  <Link
                    href="/client"
                    className="text-sm text-muted hover:text-foreground transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    Sign In
                  </Link>
                )}
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
