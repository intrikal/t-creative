"use client";

/**
 * Hero — Cinematic full-viewport opener.
 *
 * Entrance timeline (GSAP):
 *   0.0s  eyebrow fades + slides up
 *   0.1s  vertical rule scales Y from top
 *   0.25s headline chars reveal — yPercent 110→0, rotateX -40→0 (3D flip up)
 *   0.9s  subheadline words fade in staggered
 *   1.1s  CTA clip-path wipe: inset(0 100% 0 0) → inset(0 0% 0 0)
 *   1.6s  scroll hint fades in
 *
 * Scroll interactions (ScrollTrigger scrub, no ScrollSmoother):
 *   - Founder photo yPercent -8 as user scrolls (scrub 0.5)
 *   - Ghost headline text yPercent +4 counter-parallax (scrub 0.5)
 *   - Mouse move → subtle x/y tilt on the photo container
 *
 * data-cursor / data-magnetic on interactive elements for CustomCursor.
 */

import { useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import posthog from "posthog-js";
import { gsap, SplitText } from "@/lib/gsap";

export function Hero({
  headline,
  subheadline,
  ctaText,
}: {
  headline?: string;
  subheadline?: string;
  ctaText?: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const photoColRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLSpanElement>(null);

  // ScrollTrigger-based parallax (replaces ScrollSmoother data-speed which no longer exists)
  useEffect(() => {
    const photo = photoColRef.current;
    const ghost = ghostRef.current;
    if (!photo || !ghost) return;

    const ctx = gsap.context(() => {
      gsap.to(photo, {
        yPercent: -8,
        ease: "none",
        scrollTrigger: { trigger: photo, start: "top bottom", end: "bottom top", scrub: 0.5 },
      });
      gsap.to(ghost, {
        yPercent: 4,
        ease: "none",
        scrollTrigger: { trigger: ghost, start: "top bottom", end: "bottom top", scrub: 0.5 },
      });
    });

    return () => ctx.revert();
  }, []);

  // Mouse parallax tilt on photo
  useEffect(() => {
    const section = sectionRef.current;
    const photo = photoRef.current;
    if (!section || !photo) return;

    const onMove = (e: MouseEvent) => {
      const { innerWidth: w, innerHeight: h } = window;
      const rx = (e.clientY / h - 0.5) * 6; // -3° → +3°
      const ry = (e.clientX / w - 0.5) * -8; // -4° → +4°
      gsap.to(photo, {
        rotateX: rx,
        rotateY: ry,
        duration: 0.8,
        ease: "power2.out",
        transformPerspective: 800,
      });
    };

    const onLeave = () =>
      gsap.to(photo, { rotateX: 0, rotateY: 0, duration: 1, ease: "power3.out" });

    section.addEventListener("mousemove", onMove);
    section.addEventListener("mouseleave", onLeave);
    return () => {
      section.removeEventListener("mousemove", onMove);
      section.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(".hero-eyebrow", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.7 }, 0);

      tl.fromTo(
        ".hero-rule",
        { scaleY: 0, transformOrigin: "top center" },
        { scaleY: 1, duration: 1.1, ease: "power2.inOut" },
        0.1,
      );

      // Headline — SplitText 3D char flip
      if (headlineRef.current) {
        const split = new SplitText(headlineRef.current, {
          type: "chars,words,lines",
          linesClass: "overflow-hidden",
        });
        // Wrap each char's parent line in overflow:hidden so chars clip inside
        tl.fromTo(
          split.chars,
          { opacity: 0, yPercent: 110, rotateX: -45 },
          {
            opacity: 1,
            yPercent: 0,
            rotateX: 0,
            duration: 1.0,
            stagger: 0.016,
            ease: "power4.out",
          },
          0.2,
        );
      }

      // Subheadline words
      if (subRef.current) {
        const splitSub = new SplitText(subRef.current, { type: "words" });
        tl.fromTo(
          splitSub.words,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.028, ease: "power3.out" },
          0.95,
        );
      }

      // CTA — clip-path wipe from left
      tl.fromTo(
        ".hero-cta",
        { clipPath: "inset(0 100% 0 0)", opacity: 1 },
        { clipPath: "inset(0 0% 0 0)", duration: 0.8, ease: "power2.inOut" },
        1.15,
      );

      // Scroll hint
      tl.fromTo(
        ".hero-scroll-hint",
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.6 },
        1.7,
      );

      // Photo wipe in — clip set here (not inline) so SSR renders image visible for LCP
      gsap.set(".hero-photo-wrap", { clipPath: "inset(0 0 100% 0)" });
      tl.to(
        ".hero-photo-wrap",
        { clipPath: "inset(0 0 0% 0)", duration: 1.2, ease: "power3.inOut" },
        0.3,
      );
    },
    { scope: sectionRef },
  );

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex flex-col justify-end bg-surface overflow-hidden px-6 md:px-12 pb-16 md:pb-24 pt-32 md:pt-40"
      aria-label="Hero"
      style={{ perspective: "1200px" }}
    >
      {/* Ghost background type — slow counter-parallax */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
        aria-hidden="true"
      >
        <span
          ref={ghostRef}
          className="font-display text-[22vw] font-light text-foreground/[0.03] tracking-tighter leading-none whitespace-nowrap"
        >
          T Creative
        </span>
      </div>

      {/* Horizontal grain line — purely decorative */}
      <div
        className="absolute top-[45%] left-0 right-0 h-px bg-foreground/[0.04] pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl w-full">
        {/* Eyebrow */}
        <p className="hero-eyebrow opacity-0 text-[10px] tracking-[0.35em] uppercase text-muted mb-12 md:mb-16">
          San Jose, CA &nbsp;·&nbsp; T Creative Studio
        </p>

        <div className="flex flex-col md:flex-row md:items-end gap-12 md:gap-16">
          {/* Left — headline + sub + CTA */}
          <div className="flex-1">
            <div className="hero-rule w-px h-16 bg-foreground/20 mb-8 origin-top" />

            <h1
              ref={headlineRef}
              className="font-display font-light tracking-tight text-foreground leading-[0.93]"
              style={{ perspective: "800px" }}
              data-cursor="text"
            >
              {headline ? (
                <span className="block text-[clamp(3.5rem,9vw,8rem)]">{headline}</span>
              ) : (
                <>
                  <span className="block text-[clamp(3.5rem,9vw,8rem)]">Beauty.</span>
                  <span className="block text-[clamp(3.5rem,9vw,8rem)]">Craft.</span>
                  <span className="block text-[clamp(3.5rem,9vw,8rem)] text-accent">Yours.</span>
                </>
              )}
            </h1>

            <div className="mt-12 flex flex-col sm:flex-row sm:items-start gap-8 sm:gap-12">
              <p ref={subRef} className="text-sm text-muted leading-relaxed max-w-[28ch]">
                {subheadline ??
                  "Lash extensions, permanent jewelry, custom crochet, and business consulting — crafted with intention."}
              </p>

              <Link
                href="/contact"
                onClick={() =>
                  posthog.capture("cta_clicked", { cta: "book_appointment", location: "hero" })
                }
                className="hero-cta shrink-0 inline-flex items-center gap-4 text-[10px] tracking-[0.25em] uppercase text-foreground border border-foreground/30 hover:bg-foreground hover:text-background px-8 py-4 transition-colors duration-500 group"
                style={{ clipPath: "inset(0 100% 0 0)" }}
                data-cursor="link"
                data-magnetic="0.25"
              >
                {ctaText ?? "Book a Session"}
                <span className="w-4 h-px bg-current transition-all duration-300 group-hover:w-7" />
              </Link>
            </div>
          </div>

          {/* Right — founder photo */}
          <div ref={photoColRef} className="w-full md:w-[340px] lg:w-[380px] shrink-0">
            <div
              ref={photoRef}
              className="hero-photo-wrap aspect-[3/4] overflow-hidden"
              style={{ willChange: "transform" }}
              data-cursor="view"
            >
              <Image
                src="/images/trini.jpg"
                alt="Trini Lam — founder of T Creative Studio"
                width={380}
                height={507}
                className="object-cover w-full h-full scale-[1.08] transition-transform duration-700 group-hover:scale-110"
                sizes="(max-width: 768px) 100vw, 380px"
                priority
              />
            </div>
            <p className="mt-3 text-[10px] tracking-[0.25em] uppercase text-muted/40">
              Trini Lam — Founder
            </p>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="hero-scroll-hint opacity-0 absolute bottom-0 left-0 flex items-center gap-3">
          <div className="relative w-px h-14 bg-foreground/10 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[40%] bg-foreground/50 animate-[scrollLine_2s_ease-in-out_infinite]" />
          </div>
          <span className="text-[9px] tracking-[0.3em] uppercase text-muted/40">Scroll</span>
        </div>
      </div>
    </section>
  );
}
