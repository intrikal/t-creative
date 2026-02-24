/**
 * SectionHeading.tsx — Reusable two-line section label for the booking storefront.
 *
 * Not a "use client" component — it renders no interactive elements and is
 * used throughout the main content area which is already within a client boundary.
 * It can be imported by both server and client components without issue.
 */

/**
 * SectionHeading — displays an uppercase eyebrow label above a display-font title.
 *
 * Used consistently across all major sections of the booking page
 * (Services, Portfolio, Reviews, About, How it works, etc.) to establish
 * a uniform visual rhythm.
 *
 * @param eyebrow - Small uppercase accent label (e.g. "Services", "FAQ", "About").
 * @param title   - Main section title in the display font (e.g. "Book your appointment").
 */
export function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-rose-400">
        {eyebrow}
      </p>
      <h2 className="font-display text-2xl font-light text-stone-900">{title}</h2>
    </div>
  );
}
