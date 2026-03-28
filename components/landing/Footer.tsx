"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { FaInstagram, FaLinkedinIn } from "react-icons/fa";
import { socials as defaultSocials } from "@/lib/socials";

const platformIcons: Record<string, React.ComponentType<{ size?: number }>> = {
  Instagram: FaInstagram,
  LinkedIn: FaLinkedinIn,
};

const navColumns = [
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
  const name = businessName ?? "T Creative Studio";
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
      className="border-t border-foreground/5 px-6 pt-16 pb-10"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <div className="mx-auto max-w-6xl">
        {/* 4-column grid */}
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 sm:gap-8 mb-14">
          {/* Col 1 — Brand */}
          <div className="col-span-2 sm:col-span-1">
            <p className="text-sm font-semibold tracking-wide text-foreground mb-3">{name}</p>
            <p className="text-sm text-muted leading-relaxed mb-4">
              {tagline ?? "Structure makes beautiful things."}
            </p>
            <p className="text-xs text-muted/60">{location ?? "San Jose, CA"}</p>
          </div>

          {/* Col 2 & 3 — Nav columns */}
          {navColumns.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-semibold tracking-widest uppercase text-foreground mb-4">
                {col.title}
              </p>
              <ul className="flex flex-col gap-2">
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

          {/* Col 4 — Connect */}
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase text-foreground mb-4">
              Connect
            </p>
            <div className="flex flex-col gap-3">
              {socials.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors duration-200"
                    aria-label={s.description}
                  >
                    <Icon size={14} />
                    {s.label}
                  </a>
                );
              })}
              <a
                href={`mailto:${email ?? "hello@tcreativestudio.com"}`}
                className="text-sm text-muted hover:text-foreground transition-colors duration-200 break-all"
              >
                {email ?? "hello@tcreativestudio.com"}
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-foreground/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted">
            &copy; {new Date().getFullYear()} {name}. All rights reserved.
          </p>
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
