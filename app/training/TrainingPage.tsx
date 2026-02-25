/**
 * TrainingPage — All four certification programs with dates, deposits, and enrollment CTAs.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Footer } from "@/components/landing/Footer";

const programs = [
  {
    title: "Classic Lash Certification",
    color: "#C4907A",
    format: "In Person",
    schedule: "Sat & Sun, 9am–5pm (2 weekends)",
    location: "T Creative Studio — San Jose, CA",
    nextDate: "Mar 15, 2026",
    duration: "16 hours",
    price: "Starting at $1,800",
    deposit: "$500 deposit to secure your seat",
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
    ideal: "Beginners with no prior lash experience, or those self-taught looking to fill gaps.",
  },
  {
    title: "Volume Lash Certification",
    color: "#b07d6a",
    format: "In Person",
    schedule: "Sat & Sun, 9am–5pm (3 weekends)",
    location: "T Creative Studio — San Jose, CA",
    nextDate: "Apr 5, 2026",
    duration: "24 hours",
    price: "Starting at $2,200",
    deposit: "$500 deposit to secure your seat",
    description:
      "An advanced course building on classic foundations — 2D through 6D fan construction, mega volume, wispy and textured styles, and advanced mapping. Prerequisite: Classic Lash Certification or 6 months of active lash experience.",
    curriculum: [
      "2D–6D handmade fan construction",
      "Pre-made and promade fan techniques",
      "Mega volume application",
      "Wispy and textured style mapping",
      "Advanced retention and lash health",
      "Managing difficult eye shapes",
    ],
    ideal: "Certified classic lash artists ready to expand their service menu.",
    prereq: "Classic Lash Certification or 6+ months of active experience required.",
  },
  {
    title: "Permanent Jewelry Certification",
    color: "#D4A574",
    format: "In Person",
    schedule: "Saturday, 10am–4pm (1 day)",
    location: "T Creative Studio — San Jose, CA",
    nextDate: "Mar 8, 2026",
    duration: "8 hours",
    price: "Starting at $1,200",
    deposit: "$300 deposit to secure your seat",
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
    ideal: "Beauty professionals looking to add permanent jewelry to their service menu.",
  },
  {
    title: "Beauty Business Bootcamp",
    color: "#5B8A8A",
    format: "Hybrid (Virtual + In-Person)",
    schedule: "Saturdays, 10am–4pm (3 sessions)",
    location: "Virtual + T Creative Studio",
    nextDate: "Mar 29, 2026",
    duration: "18 hours",
    price: "Starting at $450",
    deposit: "$150 deposit to secure your seat",
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
    ideal: "Beauty professionals at any stage who want to run their business with more intention.",
  },
];

export function TrainingPage() {
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
            {programs.map((program, i) => (
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
                        <span className="text-xs tracking-wide uppercase px-3 py-1 bg-surface text-muted">
                          {program.duration}
                        </span>
                        <span className="text-xs tracking-wide uppercase px-3 py-1 bg-surface text-muted">
                          Certification
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-lg font-medium text-accent block">{program.price}</span>
                      <span className="text-xs text-muted mt-1 block">{program.deposit}</span>
                    </div>
                  </div>

                  {/* Next date + location */}
                  <div className="flex flex-wrap gap-4 mb-6 text-sm text-muted border border-foreground/8 bg-surface px-4 py-3">
                    <div>
                      <span className="text-[10px] uppercase tracking-widest text-muted/60 block mb-0.5">
                        Next Date
                      </span>
                      <span className="font-medium text-foreground">{program.nextDate}</span>
                    </div>
                    <div className="w-px bg-foreground/10 self-stretch" />
                    <div>
                      <span className="text-[10px] uppercase tracking-widest text-muted/60 block mb-0.5">
                        Schedule
                      </span>
                      <span>{program.schedule}</span>
                    </div>
                    <div className="w-px bg-foreground/10 self-stretch hidden sm:block" />
                    <div className="hidden sm:block">
                      <span className="text-[10px] uppercase tracking-widest text-muted/60 block mb-0.5">
                        Location
                      </span>
                      <span>{program.location}</span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted leading-relaxed mb-6">{program.description}</p>

                  {/* Prerequisite */}
                  {"prereq" in program && program.prereq && (
                    <div className="mb-6 text-xs text-muted border-l-2 border-accent/40 pl-3 leading-relaxed">
                      <span className="font-semibold text-foreground">Prerequisite: </span>
                      {program.prereq}
                    </div>
                  )}

                  {/* Who it's for */}
                  <p className="text-xs text-muted mb-6">
                    <span className="font-medium text-foreground">Ideal for: </span>
                    {program.ideal}
                  </p>

                  {/* Curriculum */}
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
