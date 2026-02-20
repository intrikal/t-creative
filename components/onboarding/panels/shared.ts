/**
 * shared.ts — Shared animation variants for onboarding panels
 *
 * What: Exports reusable Framer Motion animation configurations used across
 *       multiple panel components.
 * Why: Keeps animation timing consistent across all panels and avoids
 *      duplicating the same variant objects in every file.
 *
 * Key concepts:
 * - Framer Motion "variants" are objects that define named animation states
 *   ("hidden" and "show"). When a parent uses `variants={stagger}`, children
 *   with `variants={fadeUp}` inherit the states and animate automatically.
 */

// `fadeUp` animates an element from 16px below (hidden) to its natural position (show).
export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    // `as const` makes this array readonly and narrows each number to its exact literal type.
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

// `stagger` makes children animate one after another instead of all at once.
// `staggerChildren: 0.1` means each child animates 0.1s after the previous one.
export const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};
