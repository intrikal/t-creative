/**
 * ConsultingPage — HR & Beauty Business consulting with GSAP animations,
 * shadcn components, PostHog tracking, and CMS-driven content.
 */
"use client";

import { useRef } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, CheckCircle2, Quote } from "lucide-react";
import posthog from "posthog-js";
import { Footer } from "@/components/landing/Footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

gsap.registerPlugin(ScrollTrigger);

export function ConsultingPage({
  services,
  benefits,
  process,
  testimonials,
  ctaText,
  businessName,
  location,
  email,
  footerTagline,
  socialLinks,
}: {
  services?: {
    title: string;
    tag: string;
    description: string;
    outcomes: string[];
    idealClient: string;
  }[];
  benefits?: string[];
  process?: { step: string; title: string; description: string }[];
  testimonials?: { quote: string; name: string; role: string; result: string }[];
  ctaText?: string;
  businessName?: string;
  location?: string;
  email?: string;
  footerTagline?: string;
  socialLinks?: { platform: string; handle: string; url: string }[];
} = {}) {
  const containerRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const servicesRef = useRef<HTMLDivElement>(null);
  const processHeaderRef = useRef<HTMLDivElement>(null);
  const processGridRef = useRef<HTMLDivElement>(null);
  const testimonialsHeaderRef = useRef<HTMLDivElement>(null);
  const testimonialsGridRef = useRef<HTMLDivElement>(null);
  const benefitsRef = useRef<HTMLDivElement>(null);
  const benefitsListRef = useRef<HTMLUListElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const scrollAnim = (el: HTMLElement | null, opts?: { delay?: number; stagger?: boolean }) => {
        if (!el) return;
        const target = opts?.stagger ? el.children : el;
        gsap.fromTo(
          target,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            delay: opts?.delay ?? 0,
            ...(opts?.stagger ? { stagger: 0.12 } : {}),
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

      scrollAnim(servicesRef.current, { stagger: true });
      scrollAnim(processHeaderRef.current);
      scrollAnim(processGridRef.current, { stagger: true });
      scrollAnim(testimonialsHeaderRef.current);
      scrollAnim(testimonialsGridRef.current, { stagger: true });
      scrollAnim(benefitsRef.current);
      scrollAnim(benefitsListRef.current, { stagger: true });
      scrollAnim(ctaRef.current);
    },
    { scope: containerRef },
  );

  function trackCta(cta: string, consultingType?: string) {
    posthog.capture("cta_clicked", {
      cta,
      location: "consulting_page",
      ...(consultingType ? { consulting_type: consultingType } : {}),
    });
  }

  return (
    <>
      <main id="main-content" className="pt-16" ref={containerRef}>
        {/* Hero */}
        <section className="py-20 md:py-24 px-6 bg-foreground text-background">
          <div ref={heroRef} className="mx-auto max-w-5xl text-center">
            <span className="text-xs tracking-widest uppercase text-accent mb-6 block opacity-0">
              Remote Consulting Available
            </span>
            <h1 className="text-4xl md:text-6xl font-light tracking-tight mb-6 opacity-0">
              HR &amp; Business Consulting
            </h1>
            <p className="text-base md:text-lg text-background/60 max-w-2xl mx-auto mb-10 opacity-0">
              Two practices, one philosophy: build things that actually work. Whether you need HR
              infrastructure for a growing team or a business strategy for your beauty studio — this
              is operational expertise from someone who lives it.
            </p>
            <Link
              href="/contact?interest=Beauty%20Business%20Consulting"
              onClick={() => trackCta("book_discovery_call", "hero")}
              className="inline-flex items-center gap-2 px-8 py-3.5 text-xs tracking-wide uppercase rounded-full bg-background text-foreground hover:bg-background/90 transition-colors duration-200 opacity-0"
            >
              Book a Free Discovery Call
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* Services */}
        <section className="py-20 md:py-24 px-6">
          <div ref={servicesRef} className="mx-auto max-w-4xl flex flex-col gap-6">
            {(services ?? []).map((service) => (
              <Card
                key={service.title}
                className="opacity-0 border-muted/15 shadow-none overflow-hidden"
              >
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <CardTitle className="text-xl md:text-2xl font-light tracking-tight">
                      {service.title}
                    </CardTitle>
                    <Badge variant="secondary" className="self-start shrink-0">
                      {service.tag}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-sm text-muted leading-relaxed">{service.description}</p>

                  <div>
                    <h3 className="text-xs tracking-widest uppercase text-foreground mb-4">
                      What We Cover
                    </h3>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {service.outcomes.map((item) => (
                        <li key={item} className="text-sm text-muted flex items-start gap-2">
                          <CheckCircle2 size={14} className="text-accent mt-0.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <p className="text-xs text-muted border-l-2 border-accent/40 pl-3 leading-relaxed">
                    <span className="font-medium text-foreground">Ideal for: </span>
                    {service.idealClient}
                  </p>

                  <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                    <span className="text-sm text-accent">
                      Contact for quote — engagements vary by scope
                    </span>
                    <Link
                      href={`/contact?interest=${encodeURIComponent(service.title)}`}
                      onClick={() =>
                        trackCta(
                          "request_consultation",
                          service.title.toLowerCase().replace(/ /g, "_"),
                        )
                      }
                      className="inline-flex items-center gap-2 text-xs tracking-wide uppercase rounded-full border border-foreground/20 hover:border-accent/40 px-5 py-2.5 text-foreground hover:text-accent transition-colors duration-200"
                    >
                      Request Consultation
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="mx-auto max-w-4xl" />

        {/* How It Works */}
        {(process ?? []).length > 0 && (
          <section className="py-20 md:py-24 px-6">
            <div className="mx-auto max-w-4xl">
              <div ref={processHeaderRef} className="text-center mb-14 opacity-0">
                <span className="text-xs tracking-widest uppercase text-accent mb-4 block">
                  How It Works
                </span>
                <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground">
                  From first call to lasting change.
                </h2>
              </div>

              <div
                ref={processGridRef}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
              >
                {(process ?? []).map((item) => (
                  <Card key={item.step} className="opacity-0 border-muted/15 shadow-none">
                    <CardHeader className="pb-0">
                      <span className="text-2xl font-light text-accent">{item.step}</span>
                      <CardTitle className="text-sm">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted leading-relaxed">{item.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        <Separator className="mx-auto max-w-4xl" />

        {/* Testimonials */}
        {(testimonials ?? []).length > 0 && (
          <section className="py-20 md:py-24 px-6 bg-surface/50">
            <div className="mx-auto max-w-4xl">
              <div ref={testimonialsHeaderRef} className="text-center mb-14 opacity-0">
                <span className="text-xs tracking-widest uppercase text-accent mb-4 block">
                  Results
                </span>
                <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground">
                  What clients achieved.
                </h2>
              </div>

              <div ref={testimonialsGridRef} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(testimonials ?? []).map((t) => (
                  <Card key={t.name} className="opacity-0 border-muted/15 shadow-none">
                    <CardContent className="pt-6">
                      <Quote size={16} className="text-accent/40 mb-3" />
                      <p className="text-sm text-muted leading-relaxed mb-4">{t.quote}</p>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-medium text-foreground block">
                            {t.name}
                          </span>
                          <span className="text-[10px] text-muted">{t.role}</span>
                        </div>
                        {t.result && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {t.result}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Why Remote */}
        <section className="py-20 md:py-24 px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div ref={benefitsRef} className="opacity-0">
              <span className="text-xs tracking-widest uppercase text-accent mb-4 block">
                Why Remote
              </span>
              <h2 className="text-2xl md:text-3xl font-light tracking-tight text-foreground mb-10">
                Why Remote Consulting?
              </h2>
            </div>
            <ul ref={benefitsListRef} className="space-y-4 text-left max-w-md mx-auto">
              {(benefits ?? []).map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-muted opacity-0">
                  <CheckCircle2 size={14} className="text-accent mt-0.5 shrink-0" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <Separator className="mx-auto max-w-4xl" />

        {/* Discovery Call CTA */}
        <section className="py-20 md:py-24 px-6">
          <div
            ref={ctaRef}
            className="mx-auto max-w-4xl rounded-2xl bg-foreground text-background p-10 md:p-14 flex flex-col items-center text-center gap-6 opacity-0"
          >
            <span className="text-xs tracking-widest uppercase text-accent block">
              Free Discovery Call
            </span>
            <h2 className="text-2xl md:text-3xl font-light tracking-tight max-w-lg">
              {ctaText ?? "Let's talk about your business — no pitch, just a conversation."}
            </h2>
            <p className="text-sm text-background/60 max-w-md">
              Book a free 30-minute call. We&apos;ll talk through your goals, identify quick wins,
              and see if working together makes sense.
            </p>
            <Link
              href="/contact?interest=Beauty%20Business%20Consulting"
              onClick={() => trackCta("book_discovery_call", "bottom_cta")}
              className="inline-flex items-center gap-2 px-8 py-3.5 text-xs tracking-wide uppercase rounded-full bg-background text-foreground hover:bg-background/90 transition-colors duration-200"
            >
              Book Your Free Call
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
