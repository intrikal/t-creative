/**
 * AboutPage — Client Component rendering the public /about page.
 *
 * Sections:
 *   1. Hero — Dark-background split layout with circular founder photo and bio.
 *   2. Credentials — Key stats with Badge labels.
 *   3. Mission — "Why I started T Creative" story section.
 *   4. Timeline — Key milestones in the founder's journey.
 *   5. Certifications — Training and credentials badges.
 *   6. Service pillars — Card grid of four core offerings (linked to /services).
 *   7. Testimonials — Client quotes for social proof.
 *   8. Social links — Card grid of external profile links.
 *   9. Location CTA — "Get in Touch" call-to-action.
 *
 * Uses shadcn Card, Badge, and Separator components.
 * Uses GSAP + ScrollTrigger for scroll-triggered entry animations.
 */
"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Award, Quote, Sparkles } from "lucide-react";
import { FaInstagram, FaLinkedinIn } from "react-icons/fa";
import { Footer } from "@/components/landing/Footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { socials as defaultSocials } from "@/lib/socials";

gsap.registerPlugin(ScrollTrigger);

const platformIcons: Record<string, React.ComponentType<{ size?: number }>> = {
  Instagram: FaInstagram,
  LinkedIn: FaLinkedinIn,
};

const SERVICE_PILLARS = [
  {
    title: "Lash Extensions",
    description:
      "Precision work with classic, hybrid, and volume sets. Each appointment structured around technique and care.",
    color: "#C4907A",
  },
  {
    title: "Permanent Jewelry",
    description:
      "14k gold-filled and sterling silver chains, custom-fit and welded on. Bracelets, anklets, and necklaces.",
    color: "#D4A574",
  },
  {
    title: "Crochet Hair & Crafts",
    description:
      "Custom crochet hair installs — box braids, goddess locs, knotless braids — plus handcrafted accessories, bags, and commissioned pieces.",
    color: "#7BA3A3",
  },
  {
    title: "Business Consulting",
    description:
      "HR strategy and beauty business consulting — operational infrastructure, pricing, and systems for entrepreneurs ready to grow.",
    color: "#5B8A8A",
  },
];

export function AboutPage({
  ownerName,
  businessName,
  bio,
  mission,
  credentials,
  timeline,
  certifications,
  testimonials,
  location,
  email,
  footerTagline,
  socialLinks,
}: {
  ownerName?: string;
  businessName?: string;
  bio?: string;
  mission?: string;
  credentials?: { stat: string; label: string }[];
  timeline?: { year: string; title: string; description: string }[];
  certifications?: string[];
  testimonials?: { quote: string; name: string; service: string }[];
  location?: string;
  email?: string;
  footerTagline?: string;
  socialLinks?: { platform: string; handle: string; url: string }[];
}) {
  const socials = socialLinks
    ? socialLinks.map((s) => ({
        label: s.handle,
        href: s.url,
        icon: platformIcons[s.platform] ?? FaInstagram,
        description: s.platform,
      }))
    : defaultSocials;

  const bioParagraphs = (
    bio ??
    "A creative entrepreneur passionate about helping others feel confident and beautiful. With expertise spanning lash artistry, permanent jewelry design, handcrafted crochet, and business consulting, I bring intention and care to every creation.\n\nBased in the San Francisco Bay Area, I combine artistic vision with business acumen to transform both looks and businesses. I also work as an HR professional, bringing strategic expertise to help companies build better teams and processes."
  ).split("\n\n");

  const containerRef = useRef<HTMLElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const heroImageRef = useRef<HTMLDivElement>(null);
  const credentialsRef = useRef<HTMLDivElement>(null);
  const credentialItemsRef = useRef<HTMLDivElement>(null);
  const missionRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineItemsRef = useRef<HTMLDivElement>(null);
  const certsRef = useRef<HTMLDivElement>(null);
  const certsGridRef = useRef<HTMLDivElement>(null);
  const pillarsHeaderRef = useRef<HTMLDivElement>(null);
  const pillarsGridRef = useRef<HTMLDivElement>(null);
  const testimonialsHeaderRef = useRef<HTMLDivElement>(null);
  const testimonialsGridRef = useRef<HTMLDivElement>(null);
  const socialHeaderRef = useRef<HTMLDivElement>(null);
  const socialGridRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);

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
            ...(opts?.stagger ? { stagger: 0.1 } : {}),
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 85%", once: true },
          },
        );
      };

      // Hero — entrance on mount (no scroll trigger)
      if (heroTextRef.current) {
        gsap.fromTo(
          heroTextRef.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" },
        );
      }
      if (heroImageRef.current) {
        gsap.fromTo(
          heroImageRef.current,
          { opacity: 0, scale: 0.95 },
          { opacity: 1, scale: 1, duration: 1, delay: 0.2, ease: "power3.out" },
        );
      }

      // Scroll-triggered sections
      scrollAnim(credentialsRef.current);
      scrollAnim(credentialItemsRef.current, { stagger: true });
      scrollAnim(missionRef.current);
      scrollAnim(timelineRef.current);
      scrollAnim(timelineItemsRef.current, { stagger: true });
      scrollAnim(certsRef.current);
      scrollAnim(certsGridRef.current, { stagger: true });
      scrollAnim(pillarsHeaderRef.current);
      scrollAnim(pillarsGridRef.current, { stagger: true });
      scrollAnim(testimonialsHeaderRef.current);
      scrollAnim(testimonialsGridRef.current, { stagger: true });
      scrollAnim(socialHeaderRef.current);
      scrollAnim(socialGridRef.current, { stagger: true });
      scrollAnim(locationRef.current);
    },
    { scope: containerRef },
  );

  return (
    <>
      <main id="main-content" className="pt-16" ref={containerRef}>
        {/* Hero — dark background with circular photo */}
        <section className="bg-foreground text-background py-20 md:py-24 px-6">
          <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
            <div ref={heroTextRef} className="opacity-0">
              <span className="text-xs tracking-widest uppercase text-accent mb-6 block">
                About
              </span>
              <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-6">
                Hi, I&apos;m {ownerName ?? "Trini"}.
              </h1>
              {bioParagraphs.map((p, i) => (
                <p
                  key={i}
                  className={`text-base text-background/70 leading-relaxed ${i < bioParagraphs.length - 1 ? "mb-4" : ""}`}
                >
                  {p}
                </p>
              ))}
            </div>

            <div ref={heroImageRef} className="flex justify-center md:justify-end opacity-0">
              <div className="w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden relative shadow-2xl ring-4 ring-background/10">
                <Image
                  src="/images/trini.jpg"
                  alt={`${ownerName ?? "Trini Lam"} — Founder & Creative Director of T Creative Studio`}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 768px) 256px, 320px"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Credentials */}
        <section className="py-20 md:py-24 px-6">
          <div className="mx-auto max-w-4xl">
            <div ref={credentialsRef} className="text-center mb-14 opacity-0">
              <span className="text-xs tracking-widest uppercase text-accent mb-4 block">
                At a Glance
              </span>
              <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground">
                Built on experience.
              </h2>
            </div>

            <div
              ref={credentialItemsRef}
              className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12"
            >
              {(credentials ?? []).map((item) => (
                <div key={item.label} className="text-center opacity-0">
                  <span className="text-3xl md:text-4xl font-light text-foreground block mb-3">
                    {item.stat}
                  </span>
                  <Badge variant="secondary" className="text-[10px] tracking-wide uppercase">
                    {item.label}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Separator className="mx-auto max-w-4xl" />

        {/* Mission */}
        <section className="py-20 md:py-24 px-6">
          <div className="mx-auto max-w-3xl">
            <div ref={missionRef} className="opacity-0">
              <span className="text-xs tracking-widest uppercase text-accent mb-4 block text-center">
                My Story
              </span>
              <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground mb-8 text-center">
                Why I started T Creative.
              </h2>
              <div className="space-y-4 text-base text-muted leading-relaxed">
                {(mission ?? "").split("\n\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Separator className="mx-auto max-w-4xl" />

        {/* Timeline */}
        <section className="py-20 md:py-24 px-6">
          <div className="mx-auto max-w-4xl">
            <div ref={timelineRef} className="text-center mb-14 opacity-0">
              <span className="text-xs tracking-widest uppercase text-accent mb-4 block">
                The Journey
              </span>
              <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground">
                How we got here.
              </h2>
            </div>

            <div ref={timelineItemsRef} className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {(timeline ?? []).map((item) => (
                <Card key={item.year} className="opacity-0 border-muted/15 shadow-none">
                  <CardHeader className="pb-0">
                    <span className="text-2xl font-light text-accent">{item.year}</span>
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

        <Separator className="mx-auto max-w-4xl" />

        {/* Certifications */}
        <section className="py-20 md:py-24 px-6 bg-surface/50">
          <div className="mx-auto max-w-4xl">
            <div ref={certsRef} className="text-center mb-14 opacity-0">
              <span className="text-xs tracking-widest uppercase text-accent mb-4 block">
                Credentials
              </span>
              <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground">
                Trained &amp; certified.
              </h2>
            </div>

            <div ref={certsGridRef} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(certifications ?? []).map((cert) => (
                <Card
                  key={cert}
                  className="opacity-0 border-muted/15 shadow-none flex-row items-center gap-4 px-6 py-5"
                >
                  <Award size={18} className="text-accent shrink-0" />
                  <span className="text-sm font-medium text-foreground">{cert}</span>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* What I Do — Service Pillars */}
        <section className="py-20 md:py-24 px-6">
          <div className="mx-auto max-w-4xl">
            <div ref={pillarsHeaderRef} className="text-center mb-16 opacity-0">
              <span className="text-xs tracking-widest uppercase text-accent mb-4 block">
                What I Do
              </span>
              <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground mb-4">
                Four passions, one mission.
              </h2>
              <p className="text-base text-muted max-w-xl mx-auto">
                Helping you feel confident, beautiful, and empowered.
              </p>
            </div>

            <div ref={pillarsGridRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SERVICE_PILLARS.map((item) => (
                <Link key={item.title} href="/services" className="group opacity-0">
                  <Card className="shadow-none border-muted/15 hover:border-muted/30 transition-all duration-200 h-full">
                    <CardContent className="flex items-start gap-4 pt-6">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-foreground mb-1 group-hover:text-accent transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-sm text-muted leading-relaxed">{item.description}</p>
                      </div>
                      <ArrowRight
                        size={14}
                        className="text-muted/40 group-hover:text-accent shrink-0 mt-1 transition-colors"
                      />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <Separator className="mx-auto max-w-4xl" />

        {/* Testimonials */}
        <section className="py-20 md:py-24 px-6 bg-surface/50">
          <div className="mx-auto max-w-4xl">
            <div ref={testimonialsHeaderRef} className="text-center mb-14 opacity-0">
              <span className="text-xs tracking-widest uppercase text-accent mb-4 block">
                Kind Words
              </span>
              <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground">
                What clients say.
              </h2>
            </div>

            <div ref={testimonialsGridRef} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(testimonials ?? []).map((t) => (
                <Card key={t.name} className="opacity-0 border-muted/15 shadow-none">
                  <CardContent className="pt-6">
                    <Quote size={16} className="text-accent/40 mb-3" />
                    <p className="text-sm text-muted leading-relaxed mb-4">{t.quote}</p>
                    <div className="flex items-center gap-2">
                      <Sparkles size={12} className="text-accent" />
                      <span className="text-xs font-medium text-foreground">{t.name}</span>
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        {t.service}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Connect — Social Links */}
        <section className="py-20 md:py-24 px-6">
          <div className="mx-auto max-w-4xl">
            <div ref={socialHeaderRef} className="text-center mb-12 opacity-0">
              <span className="text-xs tracking-widest uppercase text-accent mb-4 block">
                Connect
              </span>
              <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground">
                Follow along.
              </h2>
            </div>

            <div
              ref={socialGridRef}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
            >
              {socials.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-0"
                  >
                    <Card className="shadow-none border-muted/15 hover:border-muted/30 transition-all duration-200 h-full">
                      <CardContent className="flex items-start gap-4 pt-6">
                        <Icon
                          size={20}
                          className="text-muted group-hover:text-accent transition-colors flex-shrink-0 mt-0.5"
                        />
                        <div>
                          <span className="text-sm font-medium text-foreground block mb-0.5">
                            {s.label}
                          </span>
                          <span className="text-xs text-muted">{s.description}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        <Separator className="mx-auto max-w-4xl" />

        {/* Location CTA */}
        <section className="py-20 md:py-24 px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div ref={locationRef} className="opacity-0">
              <span className="text-xs tracking-widest uppercase text-accent mb-6 block">
                Location
              </span>
              <h2 className="text-3xl md:text-4xl font-light tracking-tight text-foreground mb-6">
                Serving {location ?? "San Jose"} &amp; the Bay Area
              </h2>
              <p className="text-base text-muted leading-relaxed mb-10">
                Whether you&apos;re looking for beauty services, custom crochet work, or business
                consulting — I&apos;m here to help.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-3.5 text-xs tracking-wide uppercase bg-foreground text-background rounded-full hover:bg-foreground/80 transition-colors duration-200"
              >
                Get in Touch
              </Link>
            </div>
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
