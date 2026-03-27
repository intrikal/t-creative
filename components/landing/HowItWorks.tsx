/**
 * HowItWorks — Step-by-step booking process section.
 *
 * Typographic numbered list. Large muted step numbers as decorative counters,
 * clean title + description, thin dividers between steps.
 * Each step fades in as it enters viewport via GSAP ScrollTrigger.
 *
 * Client Component — GSAP + ScrollTrigger.
 */
"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    number: "01",
    title: "Browse Services",
    description:
      "Explore lash extensions, permanent jewelry, custom crochet, 3D-printed accessories, and business consulting. Every service page shows exactly what to expect — timing, pricing, and what's included.",
  },
  {
    number: "02",
    title: "Book Online",
    description:
      "Pick your service and choose a date and time that works for you. The booking form takes less than two minutes — no phone calls, no waiting for a reply.",
  },
  {
    number: "03",
    title: "Confirm Your Appointment",
    description:
      "Trini personally reviews every new booking and sends you a confirmation. You'll receive the studio address, arrival instructions, and anything you need to prepare — all in one message.",
  },
  {
    number: "04",
    title: "Arrive & Relax",
    description:
      "Show up at your scheduled time. The studio is set up and ready before you walk in. Every detail has been considered so you can focus on the experience.",
  },
  {
    number: "05",
    title: "Leave Glowing",
    description:
      "Walk out with results you'll love and aftercare guidance to keep them looking great. Rebooking takes seconds — your next appointment is always just a tap away.",
  },
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.fromTo(
        ".hiw-header",
        { opacity: 0, y: 16 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: { trigger: ".hiw-header", start: "top 85%", once: true },
        },
      );

      gsap.utils.toArray<HTMLElement>(".hiw-step").forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 84%", once: true },
          },
        );
      });
    },
    { scope: sectionRef },
  );

  return (
    <section
      ref={sectionRef}
      className="bg-background py-32 md:py-48 px-6"
      aria-label="How it works"
    >
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="hiw-header opacity-0 mb-16 md:mb-20">
          <span className="text-[10px] tracking-[0.3em] uppercase text-muted mb-5 block">
            How It Works
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-light tracking-tight text-foreground leading-[1.1]">
            Simple from start to finish.
          </h2>
          <p className="mt-4 text-sm text-muted max-w-md">
            Every booking is personal. Here&apos;s exactly what happens from the moment you reach
            out.
          </p>
        </div>

        {/* Steps */}
        <div>
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="hiw-step opacity-0 border-t border-foreground/10 py-8 md:py-10 flex gap-8 md:gap-12 items-start"
            >
              {/* Step number — decorative, not functional */}
              <span className="font-display text-4xl md:text-5xl font-light text-foreground/15 leading-none shrink-0 w-12 text-right">
                {step.number}
              </span>
              <div>
                <h3 className="font-display text-lg md:text-xl font-light text-foreground mb-2 tracking-tight">
                  {step.title}
                </h3>
                <p className="text-sm text-muted leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
          <div className="border-t border-foreground/10" />
        </div>
      </div>
    </section>
  );
}
