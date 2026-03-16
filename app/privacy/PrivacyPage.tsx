/**
 * PrivacyPage — Client Component rendering the Privacy Policy page.
 *
 * Content is sourced from the database via the parent server component
 * so Trini can edit it from the admin dashboard without code changes.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Footer } from "@/components/landing/Footer";
import type { LegalSection } from "@/db/schema";

interface PrivacyPageProps {
  effectiveDate: string | null;
  intro: string | null;
  sections: LegalSection[];
}

function Section({ title, paragraphs }: LegalSection) {
  return (
    <motion.section
      className="mb-10"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-base font-medium tracking-wide text-foreground mb-4">{title}</h2>
      <div className="text-sm text-muted leading-relaxed space-y-3">
        {paragraphs.map((p, i) =>
          p.startsWith("- ") ? (
            <ul key={i} className="list-disc pl-5 space-y-1.5">
              {p
                .split("\n")
                .filter((line) => line.startsWith("- "))
                .map((line, j) => (
                  <li key={j}>{line.slice(2)}</li>
                ))}
            </ul>
          ) : (
            <p key={i}>{p}</p>
          ),
        )}
      </div>
    </motion.section>
  );
}

export function PrivacyPage({ effectiveDate, intro, sections }: PrivacyPageProps) {
  const formattedDate = effectiveDate
    ? new Date(effectiveDate + "T00:00:00").toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <>
      <main id="main-content" className="pt-16">
        {/* Header */}
        <section className="py-20 md:py-28 px-6">
          <div className="mx-auto max-w-3xl">
            <motion.span
              className="text-xs tracking-widest uppercase text-muted mb-6 block"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Legal
            </motion.span>
            <motion.h1
              className="text-4xl md:text-5xl font-light tracking-tight text-foreground mb-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Privacy Policy
            </motion.h1>
            {formattedDate && (
              <motion.p
                className="text-sm text-muted"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                Effective date: {formattedDate}
              </motion.p>
            )}
          </div>
        </section>

        {/* Content */}
        <section className="pb-32 px-6">
          <div className="mx-auto max-w-3xl">
            {sections.length === 0 ? (
              <motion.p
                className="text-sm text-muted"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
              >
                Our privacy policy is being updated. Please check back soon or contact us at{" "}
                <a
                  href="mailto:hello@tcreativestudio.com"
                  className="text-foreground underline underline-offset-2 hover:text-muted transition-colors"
                >
                  hello@tcreativestudio.com
                </a>
                .
              </motion.p>
            ) : (
              <>
                {intro && (
                  <motion.p
                    className="text-sm text-muted leading-relaxed mb-10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                  >
                    {intro}
                  </motion.p>
                )}
                {sections.map((section, i) => (
                  <Section key={i} {...section} />
                ))}
                <motion.div
                  className="pt-6 border-t border-surface"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                >
                  <p className="text-xs text-muted">
                    See also our{" "}
                    <Link
                      href="/terms"
                      className="text-foreground underline underline-offset-2 hover:text-muted transition-colors"
                    >
                      Terms of Service
                    </Link>
                    .
                  </p>
                </motion.div>
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
