/**
 * Footer — Site-wide footer with brand info, navigation columns, and social links.
 *
 * Used at the bottom of the landing page (and potentially other pages).
 * Client Component — uses Framer Motion for fade-in on scroll.
 *
 * Props (all optional):
 * - email: contact email override from admin settings
 * - tagline: brand description override
 * - socialLinks: social media links from admin dashboard (platform, handle, url)
 */
"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { FaInstagram, FaLinkedinIn } from "react-icons/fa";
import { socials as defaultSocials } from "@/lib/socials";

// Maps platform names to icon components. Record<string, ComponentType> chosen for O(1)
// lookups by platform name when rendering admin-configured social links.
const platformIcons: Record<string, React.ComponentType<{ size?: number }>> = {
  Instagram: FaInstagram,
  LinkedIn: FaLinkedinIn,
};

// Static navigation columns — Services and Studio links.
// Array of {title, links[]} structure enables .map() for rendering both columns uniformly.
const columns = [
  {
    title: "Studio",
    links: [
      { label: "Portfolio", href: "/portfolio" },
      { label: "Shop", href: "/shop" },
      { label: "Training", href: "/training" },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Services",
    links: [
      { label: "Lash Extensions", href: "/services" },
      { label: "Skin Treatments", href: "/services" },
      { label: "Permanent Jewelry", href: "/services" },
      { label: "Custom Craft & 3D Printing", href: "/services" },
      { label: "Consulting", href: "/consulting" },
    ],
  },
];

export function Footer({
  businessName,
  location,
  email,
  tagline,
  socialLinks,
}: {
  businessName?: string;
  location?: string;
  email?: string;
  tagline?: string;
  socialLinks?: { platform: string; handle: string; url: string }[];
} = {}) {
  // Ternary: if admin-configured socialLinks are provided, .map() transforms them into
  // the shape expected by the render loop (label, href, icon component, description).
  // platformIcons[s.platform] ?? FaInstagram falls back to Instagram icon for unknown platforms.
  // If no socialLinks prop, uses the default socials from lib/socials.
  const socials = socialLinks
    ? socialLinks.map((s) => ({
        label: s.handle,
        href: s.url,
        icon: platformIcons[s.platform] ?? FaInstagram,
        description: s.platform,
      }))
    : defaultSocials;
  return (
    <m.footer
      className="py-16 md:py-24 px-6 border-t border-foreground/5"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <div className="mx-auto max-w-6xl">
        {/* Brand — centered */}
        <div className="text-center mb-12">
          <p className="text-sm font-medium tracking-wide text-foreground mb-3">
            {businessName ?? "T Creative Studio"}
          </p>
          <p className="text-sm text-muted leading-relaxed max-w-sm mx-auto mb-2">
            {tagline ??
              "Lash extensions, crochet hair, permanent jewelry, custom craft, 3D printing, and business consulting. Structure makes beautiful things."}
          </p>
          <p className="text-xs text-muted/60 mb-2">
            {location ?? "San Jose, CA"} · Certifications &amp; training available.
          </p>
          <p className="text-sm text-muted">{email ?? "hello@tcreativestudio.com"}</p>
        </div>

        {/* Nav columns — centered */}
        <div className="flex flex-col sm:flex-row justify-center gap-12 md:gap-20 mb-16">
          {columns.map((col) => (
            <div key={col.title} className="text-center">
              <p className="text-xs tracking-widest uppercase text-foreground mb-4">{col.title}</p>
              <ul className="flex flex-col gap-1.5">
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
            &copy; {new Date().getFullYear()} {businessName ?? "T Creative Studio"}. All rights
            reserved.
          </p>

          {/* Social icons — centered on mobile, middle on desktop */}
          <div className="flex gap-3 order-first sm:order-none">
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

          <div className="flex gap-6">
            <Link
              href="/privacy"
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </m.footer>
  );
}
