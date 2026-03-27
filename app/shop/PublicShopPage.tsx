/**
 * PublicShopPage — Public-facing product catalog with search, category filter,
 * GSAP animations, shadcn components, cart drawer, and PostHog tracking.
 */
"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, Search, ShoppingBag, X } from "lucide-react";
import posthog from "posthog-js";
import { Footer } from "@/components/landing/Footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCartStore, cartTotalInCents, cartItemCount } from "@/stores/useCartStore";
import type { ShopProduct } from "./actions";

gsap.registerPlugin(ScrollTrigger);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatPrice(product: ShopProduct): string {
  if (product.pricingType === "contact_for_quote") return "Contact for quote";
  if (product.pricingType === "price_range" && product.priceMinInCents && product.priceMaxInCents) {
    return `$${(product.priceMinInCents / 100).toFixed(0)} – $${(product.priceMaxInCents / 100).toFixed(0)}`;
  }
  if (product.pricingType === "starting_at" && (product.priceInCents || product.priceMinInCents)) {
    const price = product.priceInCents ?? product.priceMinInCents!;
    return `From $${(price / 100).toFixed(0)}`;
  }
  if (product.priceInCents) return `$${(product.priceInCents / 100).toFixed(0)}`;
  return "Contact for quote";
}

function canAddToCart(product: ShopProduct): boolean {
  return (
    product.pricingType === "fixed_price" &&
    !!product.priceInCents &&
    product.availability !== "out_of_stock"
  );
}

/* ------------------------------------------------------------------ */
/*  Cart Drawer (GSAP)                                                 */
/* ------------------------------------------------------------------ */

function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, removeItem, updateQuantity, clearCart } = useCartStore();
  const total = cartTotalInCents(items);
  const drawerRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (open) {
        if (overlayRef.current) {
          gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
        }
        if (drawerRef.current) {
          gsap.fromTo(
            drawerRef.current,
            { x: "100%" },
            { x: 0, duration: 0.4, ease: "power3.out" },
          );
        }
      }
    },
    { dependencies: [open] },
  );

  const handleClose = useCallback(() => {
    const tl = gsap.timeline({
      onComplete: onClose,
    });
    if (drawerRef.current) {
      tl.to(drawerRef.current, { x: "100%", duration: 0.3, ease: "power3.in" }, 0);
    }
    if (overlayRef.current) {
      tl.to(overlayRef.current, { opacity: 0, duration: 0.3 }, 0);
    }
  }, [onClose]);

  if (!open) return null;

  return (
    <>
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/30 z-40"
        onClick={handleClose}
        style={{ opacity: 0 }}
      />
      <aside
        ref={drawerRef}
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-muted/15 z-50 flex flex-col"
        style={{ transform: "translateX(100%)" }}
      >
        <div className="p-6 border-b border-muted/15 flex items-center justify-between">
          <h2 className="text-sm font-medium tracking-wide uppercase">Cart</h2>
          <button
            onClick={handleClose}
            className="text-muted hover:text-foreground transition-colors"
            aria-label="Close cart"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <p className="text-sm text-muted text-center py-12">Your cart is empty.</p>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.productId} className="flex gap-4 py-3 border-b border-muted/10">
                  {item.imageUrl ? (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-surface shrink-0">
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-surface flex items-center justify-center shrink-0">
                      <div className="w-3 h-3 rounded-full bg-muted/30" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted mt-1">
                      ${(item.priceInCents / 100).toFixed(2)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        className="w-6 h-6 text-xs rounded border border-muted/20 hover:border-foreground/30 transition-colors"
                      >
                        −
                      </button>
                      <span className="text-xs w-6 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="w-6 h-6 text-xs rounded border border-muted/20 hover:border-foreground/30 transition-colors"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="text-[10px] text-muted hover:text-red-500 ml-auto transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="p-6 border-t border-muted/15 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Subtotal</span>
              <span className="text-sm font-medium">${(total / 100).toFixed(2)}</span>
            </div>
            <Link
              href="/shop/checkout"
              onClick={handleClose}
              className="block w-full text-center py-3 text-xs tracking-wide uppercase rounded-full bg-foreground text-background hover:bg-foreground/80 transition-colors"
            >
              Checkout
            </Link>
            <button
              onClick={clearCart}
              className="block w-full text-center py-2 text-xs text-muted hover:text-foreground transition-colors"
            >
              Clear cart
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export function PublicShopPage({
  products,
  businessName,
  location,
  email,
  footerTagline,
  socialLinks,
}: {
  products: ShopProduct[];
  businessName?: string;
  location?: string;
  email?: string;
  footerTagline?: string;
  socialLinks?: { platform: string; handle: string; url: string }[];
}) {
  const [cartOpen, setCartOpen] = useState(false);
  const { items, addItem } = useCartStore();
  const count = cartItemCount(items);

  // Filter + search state
  const allCategories = Array.from(new Set(products.map((p) => p.category)));
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const query = searchQuery.toLowerCase().trim();

  const filtered = products
    .filter((p) => !activeCategory || p.category === activeCategory)
    .filter(
      (p) =>
        !query ||
        p.title.toLowerCase().includes(query) ||
        (p.description ?? "").toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query),
    );

  const isFiltered = activeCategory !== null || query.length > 0;

  const containerRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
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
      if (toolbarRef.current) {
        gsap.fromTo(
          toolbarRef.current,
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

  // Re-animate grid on filter/search change
  useGSAP(
    () => {
      if (gridRef.current) {
        const cards = gridRef.current.querySelectorAll("[data-animate]");
        if (cards.length > 0) {
          gsap.fromTo(
            cards,
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.4, stagger: 0.03, ease: "power3.out" },
          );
        }
      }
    },
    { scope: containerRef, dependencies: [activeCategory, searchQuery] },
  );

  function trackCta(cta: string, extra?: Record<string, string>) {
    posthog.capture("cta_clicked", { cta, location: "shop_page", ...extra });
  }

  return (
    <>
      <main id="main-content" className="pt-16" ref={containerRef}>
        {/* Hero */}
        <section className="py-12 md:py-14 px-6">
          <div ref={heroRef} className="mx-auto max-w-7xl text-center">
            <span className="text-xs tracking-widest uppercase text-accent mb-6 block opacity-0">
              Shop
            </span>
            <h1 className="text-4xl md:text-6xl font-light tracking-tight text-foreground mb-6 opacity-0">
              Take the studio home.
            </h1>
            <p className="text-base md:text-lg text-muted max-w-xl mx-auto opacity-0">
              Curated products, handmade pieces, gift cards, and everything you need — all in one
              place. Browse below, no account needed.
            </p>
          </div>
        </section>

        {/* Search + filter toolbar */}
        {products.length > 0 && (
          <div
            ref={toolbarRef}
            className="sticky top-16 z-40 bg-background/90 backdrop-blur-md border-b border-foreground/5 px-6 py-4 opacity-0"
          >
            <div className="mx-auto max-w-xl flex gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-full pl-10 pr-9 py-2.5 text-sm bg-surface rounded-lg border border-muted/20 outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:border-transparent transition-colors placeholder:text-muted/50"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Category dropdown */}
              {allCategories.length > 1 && (
                <div className="relative shrink-0">
                  <select
                    value={activeCategory ?? ""}
                    onChange={(e) => setActiveCategory(e.target.value || null)}
                    className="w-full sm:w-48 appearance-none px-4 pr-10 py-2.5 text-sm bg-surface rounded-lg border border-muted/20 outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:border-transparent transition-colors"
                  >
                    <option value="">All Categories</option>
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 6l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Result count */}
            {isFiltered && (
              <div className="mx-auto max-w-xl mt-2 text-center">
                <span className="text-xs text-muted">
                  Showing {filtered.length} of {products.length} products
                  {activeCategory && (
                    <>
                      {" "}
                      in <span className="text-foreground">{activeCategory}</span>
                    </>
                  )}
                  {query && (
                    <>
                      {" "}
                      matching &ldquo;<span className="text-foreground">{searchQuery}</span>
                      &rdquo;
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Products */}
        <section className="py-10 md:py-12 px-6">
          <div className="mx-auto max-w-7xl">
            {products.length === 0 ? (
              <div className="text-center py-20">
                <ShoppingBag size={32} className="text-muted/40 mx-auto mb-4" />
                <h2 className="text-xl font-light tracking-tight text-foreground mb-3">
                  The shop is being stocked.
                </h2>
                <p className="text-sm text-muted max-w-md mx-auto mb-8">
                  Products are on the way — from handmade pieces and aftercare essentials to gift
                  cards and more. In the meantime, check out the services or get in touch.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    href="/services"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 text-xs tracking-wide uppercase rounded-full bg-foreground text-background hover:bg-foreground/80 transition-colors"
                  >
                    Browse Services
                    <ArrowRight size={12} />
                  </Link>
                  <Link
                    href="/contact"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 text-xs tracking-wide uppercase rounded-full border border-muted/20 text-foreground hover:border-foreground/30 transition-colors"
                  >
                    Get in Touch
                  </Link>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-muted mb-4">
                  No products found{query ? ` matching "${searchQuery}"` : ""}.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setActiveCategory(null);
                  }}
                  className="text-xs tracking-wide uppercase text-accent hover:text-foreground transition-colors"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((product) => (
                  <Card
                    key={product.id}
                    data-animate
                    className={`opacity-0 border-muted/15 shadow-none overflow-hidden ${
                      product.availability === "out_of_stock" ? "opacity-60" : ""
                    }`}
                  >
                    {/* Product image */}
                    {product.imageUrl ? (
                      <div className="relative w-full aspect-[4/3] overflow-hidden bg-surface">
                        <Image
                          src={product.imageUrl}
                          alt={product.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-[4/3] flex items-center justify-center bg-surface">
                        <div className="w-4 h-4 rounded-full bg-muted/20" />
                      </div>
                    )}

                    <CardContent className="pt-5 pb-5 flex flex-col gap-3 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-medium text-foreground leading-snug">
                          {product.title}
                        </h3>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {product.category}
                        </Badge>
                      </div>

                      {product.description && (
                        <p className="text-xs text-muted leading-relaxed flex-1">
                          {product.description}
                        </p>
                      )}

                      {product.availability === "out_of_stock" && (
                        <p className="text-[11px] text-muted/70 italic">
                          Currently out of stock — check back soon.
                        </p>
                      )}

                      <Separator />

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-accent">
                          {formatPrice(product)}
                        </span>

                        <div className="flex items-center gap-2">
                          {product.serviceId && (
                            <Link
                              href="/contact?interest=Shop%20Products"
                              onClick={() => trackCta("book_product", { product: product.title })}
                              className="text-[10px] tracking-wide uppercase rounded-full border border-muted/20 hover:border-accent/40 text-foreground hover:text-accent px-3 py-1.5 transition-colors"
                            >
                              Book
                            </Link>
                          )}

                          {product.availability === "out_of_stock" ? (
                            <Badge variant="outline" className="text-[10px]">
                              Out of stock
                            </Badge>
                          ) : canAddToCart(product) ? (
                            <button
                              onClick={() => {
                                addItem({
                                  productId: product.id,
                                  title: product.title,
                                  priceInCents: product.priceInCents!,
                                  imageUrl: product.imageUrl,
                                });
                                trackCta("add_to_cart", { product: product.title });
                              }}
                              className="text-[10px] tracking-wide uppercase rounded-full bg-foreground text-background hover:bg-foreground/80 px-4 py-1.5 transition-colors"
                            >
                              Add to Cart
                            </button>
                          ) : (
                            <Link
                              href={`/contact?interest=Shop+Products&product=${encodeURIComponent(product.title)}`}
                              onClick={() =>
                                trackCta("inquire_product", { product: product.title })
                              }
                              className="text-[10px] tracking-wide uppercase rounded-full border border-muted/20 hover:border-accent/40 text-foreground hover:text-accent px-3 py-1.5 transition-colors"
                            >
                              Inquire
                            </Link>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
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
              Client Portal
            </span>
            <h2 className="text-2xl md:text-3xl font-light tracking-tight max-w-lg">
              Already a client?
            </h2>
            <p className="text-sm text-background/60 max-w-md">
              Log in to your client portal to track orders and pick them up at your next
              appointment.
            </p>
            <Link
              href="/dashboard/shop"
              onClick={() => trackCta("client_portal_shop")}
              className="inline-flex items-center gap-2 px-8 py-3.5 text-xs tracking-wide uppercase rounded-full bg-background text-foreground hover:bg-background/90 transition-colors duration-200"
            >
              Shop via Client Portal
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      </main>

      {/* Floating cart button */}
      {count > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-foreground text-background flex items-center justify-center gap-1.5 shadow-lg hover:bg-foreground/80 transition-colors"
          aria-label={`Open cart (${count} items)`}
        >
          <ShoppingBag size={18} />
          <span className="text-xs font-medium">{count}</span>
        </button>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

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
