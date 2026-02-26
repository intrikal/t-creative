/**
 * TrainingPage — Certification programs with dates, deposits, and enrollment CTAs.
 * Driven by database with hardcoded fallback.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Footer } from "@/components/landing/Footer";
import type { PublicProgram } from "./actions";

/* ------------------------------------------------------------------ */
/*  Category → color mapping                                           */
/* ------------------------------------------------------------------ */

const CATEGORY_COLORS: Record<string, string> = {
  lash: "#C4907A",
  jewelry: "#D4A574",
  crochet: "#9BB8B8",
  consulting: "#5B8A8A",
  "3d_printing": "#8B7DAF",
  aesthetics: "#B8927A",
};

/* ------------------------------------------------------------------ */
/*  Format helpers                                                     */
/* ------------------------------------------------------------------ */

function formatPrice(cents: number | null): string {
  if (cents == null) return "Contact for pricing";
  if (cents === 0) return "Free";
  const dollars = cents / 100;
  return `Starting at $${dollars % 1 === 0 ? dollars.toLocaleString() : dollars.toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(hours: number | null, days: number | null): string {
  const parts: string[] = [];
  if (hours) parts.push(`${hours} hours`);
  if (days) parts.push(`${days} day${days > 1 ? "s" : ""}`);
  return parts.join(" / ") || "";
}

const FORMAT_LABELS: Record<string, string> = {
  in_person: "In Person",
  hybrid: "Hybrid (Virtual + In-Person)",
  online: "Online",
};

/* ------------------------------------------------------------------ */
/*  Hardcoded fallback (shown when DB is empty)                        */
/* ------------------------------------------------------------------ */

type ProgramDisplay = {
  title: string;
  color: string;
  format: string;
  location: string | null;
  nextDate: string | null;
  duration: string;
  price: string;
  certificationProvided: boolean;
  description: string;
  curriculum: string[];
};

const FALLBACK_PROGRAMS: ProgramDisplay[] = [
  {
    title: "Classic Lash Certification",
    color: "#C4907A",
    format: "In Person",
    location: "T Creative Studio — San Jose, CA",
    nextDate: "Mar 15, 2026",
    duration: "16 hours",
    price: "Starting at $1,800",
    certificationProvided: true,
    description:
      "Master classic lash application from the ground up. Covers lash mapping, client consultation, adhesive chemistry, isolation technique, and retention. You'll leave with hands-on experience, a certificate, and a professional-grade take-home kit.",
    curriculum: [
      "Classic lash application and isolation technique",
      "Lash mapping and eye shape analysis",
      "Adhesive chemistry and retention troubleshooting",
      "Client consultation and contraindications",
      "Aftercare protocols and client education",
      "Business basics and pricing your services",
    ],
  },
  {
    title: "Volume Lash Certification",
    color: "#b07d6a",
    format: "In Person",
    location: "T Creative Studio — San Jose, CA",
    nextDate: "Apr 5, 2026",
    duration: "24 hours",
    price: "Starting at $2,200",
    certificationProvided: true,
    description:
      "An advanced course building on classic foundations — 2D through 6D fan construction, mega volume, wispy and textured styles, and advanced mapping.",
    curriculum: [
      "2D–6D handmade fan construction",
      "Pre-made and promade fan techniques",
      "Mega volume application",
      "Wispy and textured style mapping",
      "Advanced retention and lash health",
      "Managing difficult eye shapes",
    ],
  },
  {
    title: "Permanent Jewelry Certification",
    color: "#D4A574",
    format: "In Person",
    location: "T Creative Studio — San Jose, CA",
    nextDate: "Mar 8, 2026",
    duration: "8 hours",
    price: "Starting at $1,200",
    certificationProvided: true,
    description:
      "Learn the full permanent jewelry process — welding technique, chain types and sizing, application, and client aftercare. Includes hands-on practice with a pulse arc welder and a full jewelry start kit to take home.",
    curriculum: [
      "Pulse arc welder operation and safety",
      "Chain selection — box, rope, figaro, and more",
      "Bracelet, necklace, anklet, and ring application",
      "Sizing, fitting, and custom adjustments",
      "Contraindications and client screening",
      "Client consultation and aftercare education",
    ],
  },
  {
    title: "Beauty Business Bootcamp",
    color: "#5B8A8A",
    format: "Hybrid (Virtual + In-Person)",
    location: "Virtual + T Creative Studio",
    nextDate: "Mar 29, 2026",
    duration: "18 hours",
    price: "Starting at $450",
    certificationProvided: true,
    description:
      "The operational and business side of running a beauty studio — taught by someone who built one. Covers pricing, client management, social media, booking systems, and the mindset behind sustainable growth.",
    curriculum: [
      "Pricing strategy and service menu design",
      "Client retention and rebooking systems",
      "Instagram and content strategy for beauty pros",
      "Booking software, deposits, and cancellation policies",
      "Building a referral-based clientele",
      "When and how to hire your first assistant",
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Transform DB programs to display format                            */
/* ------------------------------------------------------------------ */

function toDisplay(programs: PublicProgram[]): ProgramDisplay[] {
  return programs.map((p) => ({
    title: p.name,
    color: CATEGORY_COLORS[p.category ?? ""] ?? "#888",
    format: FORMAT_LABELS[p.format] ?? p.format,
    location: p.nextSession?.location ?? null,
    nextDate: p.nextSession ? formatDate(p.nextSession.startsAt) : null,
    duration: formatDuration(p.durationHours, p.durationDays),
    price: formatPrice(p.priceInCents),
    certificationProvided: p.certificationProvided,
    description: p.description ?? "",
    curriculum: p.curriculum,
  }));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function TrainingPage({ programs }: { programs: PublicProgram[] }) {
  const displayPrograms: ProgramDisplay[] =
    programs.length > 0 ? toDisplay(programs) : FALLBACK_PROGRAMS;

  return (
    <>
      <main id="main-content" className="pt-16">
        {/* Hero */}
        <section className="py-24 md:py-32 px-6">
          <div className="mx-auto max-w-5xl text-center">
            <motion.span
              className="text-xs tracking-widest uppercase text-muted mb-6 block"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Training Programs
            </motion.span>
            <motion.h1
              className="text-4xl md:text-6xl font-light tracking-tight text-foreground mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Learn from an expert.
            </motion.h1>
            <motion.p
              className="text-base md:text-lg text-muted max-w-xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Certification-based programs designed to give you real technique, real confidence, and
              a foundation you can build a business on.
            </motion.p>
          </div>
        </section>

        {/* Programs */}
        <section className="pb-32 px-6">
          <div className="mx-auto max-w-4xl flex flex-col gap-8">
            {displayPrograms.map((program, i) => (
              <motion.div
                key={program.title}
                className="border border-foreground/10 overflow-hidden"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
              >
                {/* Color bar */}
                <div className="h-1.5" style={{ backgroundColor: program.color }} />

                <div className="p-8 md:p-12">
                  {/* Header */}
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-xl md:text-2xl font-light tracking-tight text-foreground mb-3">
                        {program.title}
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs tracking-wide uppercase px-3 py-1 bg-surface text-muted">
                          {program.format}
                        </span>
                        {program.duration && (
                          <span className="text-xs tracking-wide uppercase px-3 py-1 bg-surface text-muted">
                            {program.duration}
                          </span>
                        )}
                        {program.certificationProvided && (
                          <span className="text-xs tracking-wide uppercase px-3 py-1 bg-surface text-muted">
                            Certification
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-lg font-medium text-accent block">{program.price}</span>
                    </div>
                  </div>

                  {/* Next date + location */}
                  {(program.nextDate || program.location) && (
                    <div className="flex flex-wrap gap-4 mb-6 text-sm text-muted border border-foreground/8 bg-surface px-4 py-3">
                      {program.nextDate && (
                        <div>
                          <span className="text-[10px] uppercase tracking-widest text-muted/60 block mb-0.5">
                            Next Date
                          </span>
                          <span className="font-medium text-foreground">{program.nextDate}</span>
                        </div>
                      )}
                      {program.nextDate && program.location && (
                        <div className="w-px bg-foreground/10 self-stretch" />
                      )}
                      {program.location && (
                        <div>
                          <span className="text-[10px] uppercase tracking-widest text-muted/60 block mb-0.5">
                            Location
                          </span>
                          <span>{program.location}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  <p className="text-sm text-muted leading-relaxed mb-6">{program.description}</p>

                  {/* Curriculum */}
                  {program.curriculum.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-xs tracking-widest uppercase text-foreground mb-4">
                        What You&apos;ll Learn
                      </h3>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {program.curriculum.map((item) => (
                          <li key={item} className="text-sm text-muted flex items-start gap-2">
                            <span className="text-accent mt-0.5">+</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* CTA */}
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/contact"
                      className="inline-flex items-center justify-center px-6 py-3 text-xs tracking-widest uppercase border border-foreground/20 text-foreground hover:border-accent hover:text-accent transition-colors duration-200"
                    >
                      Request Info
                    </Link>
                    <Link
                      href="/dashboard/training"
                      className="inline-flex items-center justify-center px-6 py-3 text-xs tracking-widest uppercase bg-accent text-white hover:bg-accent/90 transition-colors duration-200"
                    >
                      Enroll via Client Portal
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
