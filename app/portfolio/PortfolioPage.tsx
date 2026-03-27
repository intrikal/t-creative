/**
 * PortfolioPage — Filterable portfolio gallery with lightbox, GSAP animations,
 * shadcn components, and PostHog tracking.
 */
"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, X } from "lucide-react";
import posthog from "posthog-js";
import { Footer } from "@/components/landing/Footer";
import { Badge } from "@/components/ui/badge";
import type { PublicMediaItem } from "./actions";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------ */
/*  Category config                                                    */
/* ------------------------------------------------------------------ */

type Category = "all" | "lash" | "jewelry" | "crochet";

const CATEGORY_COLORS: Record<string, string> = {
  lash: "#C4907A",
  jewelry: "#D4A574",
  crochet: "#7BA3A3",
};

const CATEGORY_LABELS: Record<string, string> = {
  lash: "Lash Extensions",
  jewelry: "Permanent Jewelry",
  crochet: "Custom Crochet",
};

const filters: { label: string; value: Category }[] = [
  { label: "All", value: "all" },
  { label: "Lash Extensions", value: "lash" },
  { label: "Permanent Jewelry", value: "jewelry" },
  { label: "Custom Crochet", value: "crochet" },
];

/* ------------------------------------------------------------------ */
/*  Display type + fallback                                            */
/* ------------------------------------------------------------------ */

type WorkItem = {
  caption: string;
  category: string;
  color: string;
  imageUrl: string | null;
  type?: string;
  beforeImageUrl?: string | null;
};

const FALLBACK_WORKS: WorkItem[] = [
  { caption: "Volume Set — Special Event", category: "lash", color: "#C4907A", imageUrl: null },
  {
    caption: "Permanent Bracelet — Gold Chain",
    category: "jewelry",
    color: "#D4A574",
    imageUrl: null,
  },
  {
    caption: "Custom Crochet — Commissioned Piece",
    category: "crochet",
    color: "#7BA3A3",
    imageUrl: null,
  },
  { caption: "Cat Eye Lash Transformation", category: "lash", color: "#C4907A", imageUrl: null },
  {
    caption: "Welded Bracelet — Sterling Silver",
    category: "jewelry",
    color: "#D4A574",
    imageUrl: null,
  },
  { caption: "Handmade Crochet Blanket", category: "crochet", color: "#7BA3A3", imageUrl: null },
  {
    caption: "Mega Volume Lashes — Red Carpet",
    category: "lash",
    color: "#C4907A",
    imageUrl: null,
  },
  {
    caption: "Permanent Bracelet — Sister Bond",
    category: "jewelry",
    color: "#D4A574",
    imageUrl: null,
  },
  { caption: "Wispy Lashes — Natural Beauty", category: "lash", color: "#C4907A", imageUrl: null },
];

function toWorkItems(media: PublicMediaItem[]): WorkItem[] {
  return media.map((m) => ({
    caption: m.caption || m.title || "",
    category: m.category ?? "lash",
    color: CATEGORY_COLORS[m.category ?? ""] ?? "#888",
    imageUrl: m.publicUrl,
    type: m.type,
    beforeImageUrl: m.beforePublicUrl,
  }));
}

/* ------------------------------------------------------------------ */
/*  Lightbox                                                           */
/* ------------------------------------------------------------------ */

function Lightbox({ item, onClose }: { item: WorkItem; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={item.caption}
    >
      <div
        className="relative max-w-4xl w-full max-h-[90vh] flex flex-col bg-background rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-background/80 backdrop-blur-sm text-foreground hover:bg-background transition-colors"
          aria-label="Close lightbox"
        >
          <X size={16} />
        </button>

        {/* Image */}
        <div className="relative aspect-[4/5] md:aspect-[3/2] w-full">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.caption}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 896px"
              priority
            />
          ) : (
            <div
              className="w-full h-full"
              style={{
                background: `linear-gradient(135deg, ${item.color}33 0%, ${item.color}11 50%, ${item.color}22 100%)`,
              }}
            />
          )}
        </div>

        {/* Caption + CTA */}
        <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground mb-1">{item.caption}</p>
            <Badge variant="outline" className="text-[10px]">
              {CATEGORY_LABELS[item.category] ?? item.category}
            </Badge>
          </div>
          <Link
            href={`/contact?interest=${encodeURIComponent(CATEGORY_LABELS[item.category] ?? item.category)}`}
            onClick={() =>
              posthog.capture("cta_clicked", {
                cta: "book_this_look",
                location: "portfolio_lightbox",
                category: item.category,
              })
            }
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs tracking-wide uppercase rounded-full bg-foreground text-background hover:bg-foreground/80 transition-colors duration-200 shrink-0"
          >
            Book This Look
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PortfolioPage({
  media,
  businessName,
  location,
  email,
  footerTagline,
  socialLinks,
}: {
  media: PublicMediaItem[];
  businessName?: string;
  location?: string;
  email?: string;
  footerTagline?: string;
  socialLinks?: { platform: string; handle: string; url: string }[];
}) {
  const [active, setActive] = useState<Category>("all");
  const [lightboxItem, setLightboxItem] = useState<WorkItem | null>(null);

  const works: WorkItem[] = media.length > 0 ? toWorkItems(media) : FALLBACK_WORKS;

  const allBeforeAfter = works.filter(
    (w) => w.type === "before_after" && w.imageUrl && w.beforeImageUrl,
  );
  const regularWorks = works.filter((w) => w.type !== "before_after");

  const filteredBeforeAfter =
    active === "all" ? allBeforeAfter : allBeforeAfter.filter((w) => w.category === active);
  const filtered =
    active === "all" ? regularWorks : regularWorks.filter((w) => w.category === active);

  const totalFiltered = filteredBeforeAfter.length + filtered.length;
  const totalAll = works.length;
  const isFiltered = active !== "all";

  const containerRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  // Mount animations
  useGSAP(
    () => {
      if (heroRef.current) {
        gsap.fromTo(
          heroRef.current.children,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: "power3.out" },
        );
      }
      if (filtersRef.current) {
        gsap.fromTo(
          filtersRef.current,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.5, delay: 0.3, ease: "power3.out" },
        );
      }
      if (ctaRef.current) {
        gsap.fromTo(
          ctaRef.current,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power3.out",
            scrollTrigger: { trigger: ctaRef.current, start: "top 85%", once: true },
          },
        );
      }
    },
    { scope: containerRef },
  );

  // Re-animate grid when filter changes
  useGSAP(
    () => {
      if (gridRef.current) {
        const items = gridRef.current.querySelectorAll("[data-animate]");
        if (items.length > 0) {
          gsap.fromTo(
            items,
            { opacity: 0, scale: 0.95 },
            { opacity: 1, scale: 1, duration: 0.4, stagger: 0.03, ease: "power3.out" },
          );
        }
      }
    },
    { scope: containerRef, dependencies: [active] },
  );

  function openLightbox(item: WorkItem) {
    setLightboxItem(item);
    posthog.capture("portfolio_image_viewed", {
      caption: item.caption,
      category: item.category,
    });
  }

  return (
    <>
      <main id="main-content" className="pt-16" ref={containerRef}>
        {/* Hero */}
        <section className="py-20 md:py-24 px-6">
          <div ref={heroRef} className="mx-auto max-w-7xl text-center">
            <span className="text-xs tracking-widest uppercase text-accent mb-6 block opacity-0">
              Portfolio
            </span>
            <h1 className="text-4xl md:text-6xl font-light tracking-tight text-foreground mb-6 opacity-0">
              Explore the work.
            </h1>
            <p className="text-base md:text-lg text-muted max-w-xl mx-auto opacity-0">
              Each piece tells a story of intention, care, and transformation.
            </p>
          </div>
        </section>

        {/* Filter + Grid */}
        <section className="pb-24 px-6">
          <div className="mx-auto max-w-7xl">
            {/* Filters */}
            <div ref={filtersRef} className="flex flex-wrap gap-2 mb-6 justify-center opacity-0">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => {
                    setActive(f.value);
                    if (f.value !== "all") {
                      posthog.capture("portfolio_filter_used", { category: f.value });
                    }
                  }}
                  className={`px-5 py-2 text-xs tracking-wide rounded-full border transition-colors duration-200 ${
                    active === f.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-muted/20 text-muted hover:text-foreground hover:border-foreground/30"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Result count */}
            {isFiltered && (
              <p className="text-xs text-muted text-center mb-8">
                Showing {totalFiltered} of {totalAll} works
              </p>
            )}

            {/* Before & After Transformations */}
            {filteredBeforeAfter.length > 0 && (
              <div className="mb-12">
                <h2 className="text-lg font-light tracking-tight text-foreground text-center mb-2">
                  Transformations
                </h2>
                <p className="text-xs text-muted text-center mb-8">
                  Drag to reveal the before &amp; after.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                  {filteredBeforeAfter.map((item) => (
                    <div
                      key={`ba-${item.caption}`}
                      className="rounded-lg overflow-hidden shadow-sm border border-muted/15"
                    >
                      <BeforeAfterSlider
                        beforeSrc={item.beforeImageUrl!}
                        afterSrc={item.imageUrl!}
                        alt={item.caption}
                      />
                      {item.caption && (
                        <p className="text-sm text-muted px-4 py-3 text-center">{item.caption}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Grid */}
            <div ref={gridRef} className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {filtered.map((item) => (
                <button
                  key={item.caption}
                  data-animate
                  className="group relative overflow-hidden rounded-lg opacity-0 text-left"
                  onClick={() => openLightbox(item)}
                  aria-label={`View ${item.caption}`}
                >
                  {item.imageUrl ? (
                    <div className="aspect-[4/5] relative">
                      <Image
                        src={item.imageUrl}
                        alt={item.caption}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 50vw, 33vw"
                      />
                    </div>
                  ) : (
                    <div
                      className="aspect-[4/5] transition-transform duration-500 group-hover:scale-105"
                      style={{
                        background: `linear-gradient(135deg, ${item.color}33 0%, ${item.color}11 50%, ${item.color}22 100%)`,
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-end p-4 md:p-6">
                    <div className="opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                      <p className="text-sm text-white mb-1">{item.caption}</p>
                      <Badge variant="outline" className="text-[9px] text-white/70 border-white/30">
                        {CATEGORY_LABELS[item.category] ?? item.category}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {filtered.length === 0 && filteredBeforeAfter.length === 0 && (
              <div className="text-center py-16">
                <p className="text-sm text-muted mb-4">No works found in this category yet.</p>
                <button
                  onClick={() => setActive("all")}
                  className="text-xs tracking-wide uppercase text-accent hover:text-foreground transition-colors"
                >
                  View all work
                </button>
              </div>
            )}

            {media.length === 0 && (
              <p className="text-center text-xs text-muted mt-8">
                Portfolio images coming soon — placeholders shown.
              </p>
            )}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="pb-24 px-6">
          <div
            ref={ctaRef}
            className="mx-auto max-w-7xl rounded-2xl bg-foreground text-background p-10 md:p-14 flex flex-col items-center text-center gap-6 opacity-0"
          >
            <span className="text-xs tracking-widest uppercase text-accent block">
              Like What You See?
            </span>
            <h2 className="text-2xl md:text-3xl font-light tracking-tight max-w-lg">
              Ready to book your own transformation?
            </h2>
            <p className="text-sm text-background/60 max-w-md">
              Reach out to discuss your vision. Every service is tailored to you.
            </p>
            <Link
              href="/contact"
              onClick={() =>
                posthog.capture("cta_clicked", {
                  cta: "portfolio_book",
                  location: "portfolio_bottom",
                })
              }
              className="inline-flex items-center gap-2 px-8 py-3.5 text-xs tracking-wide uppercase rounded-full bg-background text-foreground hover:bg-background/90 transition-colors duration-200"
            >
              Get in Touch
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      </main>

      {/* Lightbox */}
      {lightboxItem && <Lightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />}

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
