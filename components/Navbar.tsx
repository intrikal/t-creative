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

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { TCLogo } from "./TCLogo";

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [profileOpen]);

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
        <Link href="/" className="flex items-center gap-2 text-foreground">
          <TCLogo size={32} />
          <span className="text-sm font-medium tracking-wide hidden sm:inline">
            T Creative Studio
          </span>
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
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex-shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-foreground/20"
                aria-label="Profile menu"
              >
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.name}
                    width={32}
                    height={32}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-medium text-foreground">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-48 bg-background border border-foreground/10 shadow-lg rounded-md py-1 z-50"
                  >
                    <div className="px-4 py-2 border-b border-foreground/10">
                      <p className="text-xs font-medium text-foreground truncate">{user.name}</p>
                    </div>
                    {[
                      { label: "Dashboard", href: "/dashboard" },
                      { label: "My Bookings", href: "/dashboard/bookings" },
                      { label: "Messages", href: "/dashboard/messages" },
                      { label: "Account Settings", href: "/dashboard/settings" },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block px-4 py-2 text-xs text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                        onClick={() => setProfileOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                    <div className="border-t border-foreground/10">
                      <form action="/auth/signout" method="POST">
                        <button
                          type="submit"
                          className="w-full text-left px-4 py-2 text-xs text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                        >
                          Sign Out
                        </button>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link
              href="/login"
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
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 pb-2">
                      {user.avatarUrl ? (
                        <Image
                          src={user.avatarUrl}
                          alt={user.name}
                          width={28}
                          height={28}
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-medium text-foreground">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-medium text-foreground">{user.name}</span>
                    </div>
                    {[
                      { label: "Dashboard", href: "/dashboard" },
                      { label: "My Bookings", href: "/dashboard/bookings" },
                      { label: "Messages", href: "/dashboard/messages" },
                      { label: "Account Settings", href: "/dashboard/settings" },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="text-sm text-muted hover:text-foreground transition-colors pl-10"
                        onClick={() => setMobileOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                    <form action="/auth/signout" method="POST">
                      <button
                        type="submit"
                        className="w-full text-left text-sm text-muted hover:text-foreground transition-colors pl-10"
                      >
                        Sign Out
                      </button>
                    </form>
                  </div>
                ) : (
                  <Link
                    href="/login"
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
