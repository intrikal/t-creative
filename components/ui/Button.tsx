/**
 * Button — Polymorphic button/link component with motion animation.
 *
 * Renders as:
 * - `<button>` when no `href` or when `onClick` is provided
 * - Next.js `<Link>` for internal navigation (href starts with `/`)
 * - `<a>` for external links
 *
 * Client Component — uses Framer Motion for hover/tap micro-interactions.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";

type ButtonVariant = "primary" | "secondary";

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  href?: string;
  onClick?: () => void;
  className?: string;
}

/** Motion-wrapped primitives hoisted to module scope to avoid re-creation per render. */
const MotionButton = motion.button;
const MotionAnchor = motion.a;
const MotionLink = motion.create(Link);

const motionProps = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.2 },
} as const;

export function Button({
  children,
  variant = "primary",
  href,
  onClick,
  className = "",
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center px-8 py-3.5 text-sm tracking-wide uppercase transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  const variants: Record<ButtonVariant, string> = {
    primary: "bg-btn-primary text-btn-text hover:bg-muted",
    secondary:
      "border border-foreground/20 text-foreground hover:border-foreground/40 hover:bg-hover",
  };

  const classes = `${base} ${variants[variant]} ${className}`;

  // Button mode: no href, or onClick overrides href
  if (!href || onClick) {
    return (
      <MotionButton type="button" onClick={onClick} className={classes} {...motionProps}>
        {children}
      </MotionButton>
    );
  }

  // Internal link: use Next.js Link for client-side navigation
  const isInternal = href.startsWith("/") || href.startsWith("#");

  if (isInternal) {
    return (
      <MotionLink href={href} className={classes} {...motionProps}>
        {children}
      </MotionLink>
    );
  }

  // External link
  return (
    <MotionAnchor
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={classes}
      {...motionProps}
    >
      {children}
    </MotionAnchor>
  );
}
