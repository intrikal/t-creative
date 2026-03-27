/**
 * TrainingPage — Public-facing certification program listing at /training.
 *
 * Renders a hero, program cards (from DB with fallback), instructor section,
 * student testimonials, and FAQ. Uses GSAP + ScrollTrigger, shadcn components,
 * and PostHog CTA tracking.
 */
"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Award, CheckCircle2, ChevronDown, Quote } from "lucide-react";
import posthog from "posthog-js";
import { Footer } from "@/components/landing/Footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { PublicProgram } from "./actions";

gsap.registerPlugin(ScrollTrigger);

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
  hybrid: "Hybrid",
  online: "Online",
};

/* ------------------------------------------------------------------ */
/*  Display type + transform                                           */
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
  kitIncluded: boolean;
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
    kitIncluded: true,
    description:
      "Master classic lash application from the ground up. Covers lash mapping, client consultation, adhesive chemistry, isolation technique, and retention.",
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
    kitIncluded: true,
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
    kitIncluded: true,
    description:
      "Learn the full permanent jewelry process — welding technique, chain types and sizing, application, and client aftercare. Includes hands-on practice with a pulse arc welder.",
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
    format: "Hybrid",
    location: "Virtual + T Creative Studio",
    nextDate: "Mar 29, 2026",
    duration: "18 hours",
    price: "Starting at $450",
    certificationProvided: true,
    kitIncluded: false,
    description:
      "The operational and business side of running a beauty studio — pricing, client management, social media, booking systems, and sustainable growth.",
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
    kitIncluded: p.kitIncluded,
    description: p.description ?? "",
    curriculum: p.curriculum,
  }));
}

/* ------------------------------------------------------------------ */
/*  FAQ Accordion                                                      */
/* ------------------------------------------------------------------ */

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    const content = contentRef.current;
    if (!content) return;

    if (open) {
      gsap.to(content, {
        height: 0,
        opacity: 0,
        duration: 0.3,
        ease: "power3.out",
        onComplete: () => setOpen(false),
      });
    } else {
      setOpen(true);
      gsap.set(content, { height: "auto", opacity: 1 });
      const h = content.offsetHeight;
      gsap.fromTo(
        content,
        { height: 0, opacity: 0 },
        { height: h, opacity: 1, duration: 0.3, ease: "power3.out" },
      );
    }
  }, [open]);

  return (
    <div className="border-b border-foreground/10">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors duration-200 pr-4">
          {question}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div ref={contentRef} className="overflow-hidden" style={{ height: 0, opacity: 0 }}>
        <p className="text-sm text-muted leading-relaxed pb-5">{answer}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function TrainingPage({
  programs,
  testimonials,
  faqEntries,
  ownerName,
  businessName,
  location,
  email,
  footerTagline,
  socialLinks,
}: {
  programs: PublicProgram[];
  testimonials?: { quote: string; name: string; program: string }[];
  faqEntries?: { question: string; answer: string }[];
  ownerName?: string;
  businessName?: string;
  location?: string;
  email?: string;
  footerTagline?: string;
  socialLinks?: { platform: string; handle: string; url: string }[];
}) {
  const displayPrograms: ProgramDisplay[] =
    programs.length > 0 ? toDisplay(programs) : FALLBACK_PROGRAMS;

  const containerRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const programsRef = useRef<HTMLDivElement>(null);
  const instructorRef = useRef<HTMLDivElement>(null);
  const testimonialsHeaderRef = useRef<HTMLDivElement>(null);
  const testimonialsGridRef = useRef<HTMLDivElement>(null);
  const faqHeaderRef = useRef<HTMLDivElement>(null);
  const faqListRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const scrollAnim = (el: HTMLElement | null, opts?: { stagger?: boolean }) => {
        if (!el) return;
        const target = opts?.stagger ? el.children : el;
        gsap.fromTo(
          target,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ...(opts?.stagger ? { stagger: 0.1 } : {}),
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          },
        );
      };

      // Hero — entrance on mount
      if (heroRef.current) {
        gsap.fromTo(
          heroRef.current.children,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: "power3.out" },
        );
      }

      scrollAnim(programsRef.current, { stagger: true });
      scrollAnim(instructorRef.current);
      scrollAnim(testimonialsHeaderRef.current);
      scrollAnim(testimonialsGridRef.current, { stagger: true });
      scrollAnim(faqHeaderRef.current);
      scrollAnim(faqListRef.current);
      scrollAnim(ctaRef.current);
    },
    { scope: containerRef },
  );

  function trackCta(cta: string, program?: string) {
    posthog.capture("cta_clicked", {
      cta,
      location: "training_page",
      ...(program ? { program } : {}),
    });
  }

  return (
    <>
      <main id="main-content" className="pt-16" ref={containerRef}>
        {/* Hero */}
        <section className="py-20 md:py-24 px-6">
          <div ref={heroRef} className="mx-auto max-w-5xl text-center">
            <span className="text-xs tracking-widest uppercase text-accent mb-6 block opacity-0">
              Training Programs
            </span>
            <h1 className="text-4xl md:text-6xl font-light tracking-tight text-foreground mb-6 opacity-0">
              Learn from an expert.
            </h1>
            <p className="text-base md:text-lg text-muted max-w-xl mx-auto opacity-0">
              Certification-based programs designed to give you real technique, real confidence, and
              a foundation you can build a business on.
            </p>
          </div>
        </section>

        {/* Programs */}
        <section className="pb-20 md:pb-24 px-6">
          <div ref={programsRef} className="mx-auto max-w-5xl flex flex-col gap-6">
            {displayPrograms.map((program) => (
              <Card
                key={program.title}
                className="opacity-0 border-muted/15 shadow-none overflow-hidden"
              >
                {/* Color bar */}
                <div className="h-1.5" style={{ backgroundColor: program.color }} />

                <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr]">
                  {/* Left column — quick-scan info */}
                  <div className="p-6 md:p-8 md:border-r md:border-muted/15 flex flex-col gap-5">
                    <div>
                      <h2 className="text-lg md:text-xl font-light tracking-tight text-foreground mb-3">
                        {program.title}
                      </h2>
                      <span className="text-xl font-medium text-accent block">{program.price}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {program.format}
                      </Badge>
                      {program.duration && (
                        <Badge variant="secondary" className="text-[10px]">
                          {program.duration}
                        </Badge>
                      )}
                      {program.certificationProvided && (
                        <Badge variant="secondary" className="text-[10px]">
                          <Award size={10} className="mr-1" />
                          Certification
                        </Badge>
                      )}
                      {program.kitIncluded && (
                        <Badge variant="secondary" className="text-[10px]">
                          Kit Included
                        </Badge>
                      )}
                    </div>

                    {/* Next date + location */}
                    {(program.nextDate || program.location) && (
                      <div className="space-y-2 text-sm">
                        {program.nextDate && (
                          <div>
                            <span className="text-[10px] uppercase tracking-widest text-muted/60 block mb-0.5">
                              Next Date
                            </span>
                            <span className="font-medium text-foreground">{program.nextDate}</span>
                          </div>
                        )}
                        {program.location && (
                          <div>
                            <span className="text-[10px] uppercase tracking-widest text-muted/60 block mb-0.5">
                              Location
                            </span>
                            <span className="text-muted">{program.location}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* CTA */}
                    <Link
                      href={`/contact?interest=${encodeURIComponent(program.title)}`}
                      onClick={() => trackCta("request_info", program.title)}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 text-xs tracking-wide uppercase rounded-full bg-foreground text-background hover:bg-foreground/80 transition-colors duration-200 mt-auto"
                    >
                      Request Info
                      <ArrowRight size={12} />
                    </Link>
                  </div>

                  {/* Right column — details */}
                  <div className="p-6 md:p-8 space-y-6 border-t md:border-t-0 border-muted/15">
                    <p className="text-sm text-muted leading-relaxed">{program.description}</p>

                    {/* Curriculum */}
                    {program.curriculum.length > 0 && (
                      <div>
                        <h3 className="text-xs tracking-widest uppercase text-foreground mb-4">
                          What You&apos;ll Learn
                        </h3>
                        <ul className="space-y-2">
                          {program.curriculum.map((item) => (
                            <li key={item} className="text-sm text-muted flex items-start gap-2">
                              <CheckCircle2 size={14} className="text-accent mt-0.5 shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="mx-auto max-w-5xl" />

        {/* Instructor */}
        <section className="py-20 md:py-24 px-6 bg-surface/50">
          <div ref={instructorRef} className="mx-auto max-w-3xl opacity-0">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="w-20 h-20 rounded-full overflow-hidden relative shrink-0 ring-2 ring-accent/20">
                <Image
                  src="/images/trini.jpg"
                  alt={`${ownerName ?? "Trini Lam"} — Instructor`}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
              <div>
                <span className="text-xs tracking-widest uppercase text-accent mb-2 block">
                  Your Instructor
                </span>
                <h2 className="text-xl md:text-2xl font-light tracking-tight text-foreground mb-3">
                  {ownerName ?? "Trini"} — Founder &amp; Lead Trainer
                </h2>
                <p className="text-sm text-muted leading-relaxed mb-4">
                  Certified lash technician, permanent jewelry artist, and HR professional with 5+
                  years of hands-on experience. Every program is built on real technique and real
                  business knowledge — not theory.
                </p>
                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 text-xs tracking-wide uppercase text-foreground hover:text-accent transition-colors"
                >
                  Learn more about {ownerName ?? "Trini"}
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        {(testimonials ?? []).length > 0 && (
          <>
            <Separator className="mx-auto max-w-5xl" />
            <section className="py-20 md:py-24 px-6">
              <div className="mx-auto max-w-5xl">
                <div ref={testimonialsHeaderRef} className="text-center mb-14 opacity-0">
                  <span className="text-xs tracking-widest uppercase text-accent mb-4 block">
                    Student Stories
                  </span>
                  <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground">
                    What graduates say.
                  </h2>
                </div>

                <div ref={testimonialsGridRef} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(testimonials ?? []).map((t) => (
                    <Card key={t.name} className="opacity-0 border-muted/15 shadow-none">
                      <CardContent className="pt-6">
                        <Quote size={16} className="text-accent/40 mb-3" />
                        <p className="text-sm text-muted leading-relaxed mb-4">{t.quote}</p>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Award size={12} className="text-accent" />
                            <span className="text-xs font-medium text-foreground">{t.name}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {t.program}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {/* FAQ */}
        {(faqEntries ?? []).length > 0 && (
          <>
            <Separator className="mx-auto max-w-5xl" />
            <section className="py-20 md:py-24 px-6" aria-label="FAQ">
              <div className="mx-auto max-w-3xl">
                <div ref={faqHeaderRef} className="text-center mb-12 md:mb-16 opacity-0">
                  <span className="text-xs tracking-widest uppercase text-accent mb-4 block">
                    FAQ
                  </span>
                  <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground">
                    Common questions.
                  </h2>
                </div>

                <div ref={faqListRef} className="opacity-0">
                  {(faqEntries ?? []).map((item) => (
                    <FAQItem key={item.question} question={item.question} answer={item.answer} />
                  ))}
                </div>
              </div>
            </section>
          </>
        )}

        {/* Bottom CTA */}
        <Separator className="mx-auto max-w-5xl" />
        <section className="py-20 md:py-24 px-6">
          <div
            ref={ctaRef}
            className="mx-auto max-w-5xl rounded-2xl bg-foreground text-background p-10 md:p-14 flex flex-col items-center text-center gap-6 opacity-0"
          >
            <span className="text-xs tracking-widest uppercase text-accent block">Get Started</span>
            <h2 className="text-2xl md:text-3xl font-light tracking-tight max-w-lg">
              Ready to learn a new skill?
            </h2>
            <p className="text-sm text-background/60 max-w-md">
              Reach out to learn more about upcoming sessions, ask questions, or reserve your spot
              in the next cohort.
            </p>
            <Link
              href="/contact?interest=Training%20Programs"
              onClick={() => trackCta("get_started_training")}
              className="inline-flex items-center gap-2 px-8 py-3.5 text-xs tracking-wide uppercase rounded-full bg-background text-foreground hover:bg-background/90 transition-colors duration-200"
            >
              Get in Touch
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      </main>
      <Footer
        businessName={businessName}
        location={location}
        email={email}
        tagline={footerTagline}
        socialLinks={socialLinks}
      />
    </>
  );
}
