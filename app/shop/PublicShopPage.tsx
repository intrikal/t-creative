/**
 * PublicShopPage — Public-facing product catalog rendered at /shop.
 *
 * Displays a grid of ShopProduct cards fetched from the database (passed in
 * via props from a Server Component). Each card shows an image, category
 * badge, description, and a context-sensitive action:
 *   - Fixed-price items: "Add to Cart" (stored in a Zustand cart store)
 *   - Variable/quote items: "Inquire" link to /contact
 *   - Dual-listed (also a bookable service): additional "Book" link
 *   - Out-of-stock items: greyed out with no action
 *
 * Includes a slide-in CartDrawer component and a floating cart button
 * that appears when items have been added.
 *
 * This is a Client Component ("use client") because it reads/writes the
 * Zustand cart store (client-side state), manages the cart-drawer open/close
 * toggle, and uses Framer Motion for entry animations.
 */
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { m, AnimatePresence } from "framer-motion";
import { Footer } from "@/components/landing/Footer";
import { useCartStore, cartTotalInCents, cartItemCount } from "@/stores/useCartStore";
import type { ShopProduct } from "./actions";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

// Renders a human-readable price string based on the product's pricing type.
// Falls through to "Contact for quote" when no price data is available.
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

// Only fixed-price, in-stock items can be added to the cart — variable
// pricing or out-of-stock items get an "Inquire" link instead.
function canAddToCart(product: ShopProduct): boolean {
  return (
    product.pricingType === "fixed_price" &&
    !!product.priceInCents &&
    product.availability !== "out_of_stock"
  );
}

/* ------------------------------------------------------------------ */
/*  Cart Drawer                                                        */
/* ------------------------------------------------------------------ */

// Slide-in drawer that renders the current cart contents from the Zustand
// store. Supports quantity adjustments, item removal, and links to checkout.
function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, removeItem, updateQuantity, clearCart } = useCartStore();
  const total = cartTotalInCents(items);

  return (
    <AnimatePresence>
      {open && (
        <>
          <m.div
            className="fixed inset-0 bg-black/30 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <m.aside
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-foreground/8 z-50 flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div className="p-6 border-b border-foreground/8 flex items-center justify-between">
              <h2 className="text-sm font-medium tracking-wide uppercase">Cart</h2>
              <button onClick={onClose} className="text-xs text-muted hover:text-foreground">
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {items.length === 0 ? (
                <p className="text-sm text-muted text-center py-12">Your cart is empty.</p>
              ) : (
                <div className="space-y-4">
                  {/* Render each cart item with image, title, price, quantity
                      controls, and a remove button. Keyed by productId since
                      each product appears at most once in the cart. */}
                  {items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex gap-4 py-3 border-b border-foreground/5"
                    >
                      {item.imageUrl ? (
                        <div className="relative w-16 h-16 bg-surface">
                          <Image
                            src={item.imageUrl}
                            alt={item.title}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-surface flex items-center justify-center">
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
                            className="w-6 h-6 text-xs border border-foreground/10 hover:border-foreground/30"
                          >
                            −
                          </button>
                          <span className="text-xs w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            className="w-6 h-6 text-xs border border-foreground/10 hover:border-foreground/30"
                          >
                            +
                          </button>
                          <button
                            onClick={() => removeItem(item.productId)}
                            className="text-[10px] text-muted hover:text-red-500 ml-auto"
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
              <div className="p-6 border-t border-foreground/8 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Subtotal</span>
                  <span className="text-sm font-medium">${(total / 100).toFixed(2)}</span>
                </div>
                <Link
                  href="/shop/checkout"
                  onClick={onClose}
                  className="block w-full text-center py-3 text-xs tracking-widest uppercase bg-foreground text-background hover:bg-muted transition-colors"
                >
                  Checkout
                </Link>
                <button
                  onClick={clearCart}
                  className="block w-full text-center py-2 text-xs text-muted hover:text-foreground"
                >
                  Clear cart
                </button>
              </div>
            )}
          </m.aside>
        </>
      )}
    </AnimatePresence>
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
  // Whether the cart drawer is visible. Separate from the Zustand store
  // because drawer visibility is purely UI state, not persisted data.
  const [cartOpen, setCartOpen] = useState(false);
  const { items, addItem } = useCartStore();
  const count = cartItemCount(items);

  // Derive unique category names from the product list. Uses Set to deduplicate
  // and Array.from() to convert back to an array. This is computed on each
  // render (cheap — product count is small) rather than passed as a separate
  // prop, keeping the data source as the single source of truth.
  const categories = Array.from(new Set(products.map((p) => p.category)));

  return (
    <>
      <main id="main-content" className="pt-16">
        {/* Hero */}
        <section className="py-24 md:py-32 px-6">
          <div className="mx-auto max-w-5xl text-center">
            <m.span
              className="text-xs tracking-widest uppercase text-muted mb-6 block"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Shop
            </m.span>
            <m.h1
              className="text-4xl md:text-6xl font-light tracking-tight text-foreground mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Take the studio home.
            </m.h1>
            <m.p
              className="text-base md:text-lg text-muted max-w-xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Aftercare products, handmade items, training packages, and studio merch. Browse below
              — no account needed.
            </m.p>
          </div>
        </section>

        {/* Products */}
        <section className="pb-24 px-6">
          <div className="mx-auto max-w-5xl">
            {products.length === 0 ? (
              <p className="text-center text-muted py-16">
                No products available yet. Check back soon!
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Render one animated card per product. The index drives a staggered
                    delay for a cascading fade-in effect as the grid enters the viewport. */}
                {products.map((product, i) => (
                  <m.div
                    key={product.id}
                    className={`border border-foreground/8 flex flex-col ${product.availability === "out_of_stock" ? "opacity-60" : ""}`}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.07 }}
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
                      <div className="w-full aspect-[4/3] flex items-center justify-center bg-foreground/[0.03]">
                        <div className="w-4 h-4 rounded-full bg-muted/20" />
                      </div>
                    )}

                    <div className="p-6 flex flex-col gap-3 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-medium text-foreground leading-snug">
                          {product.title}
                        </h3>
                        <span className="text-[10px] tracking-wide uppercase text-muted bg-surface border border-foreground/8 px-2 py-0.5 shrink-0">
                          {product.category}
                        </span>
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

                      <div className="flex items-center justify-between pt-3 border-t border-foreground/5 mt-auto gap-3">
                        <span className="text-sm font-medium text-accent">
                          {formatPrice(product)}
                        </span>

                        <div className="flex items-center gap-2">
                          {/* Dual-listed: show Book Appointment link */}
                          {product.serviceId && (
                            <Link
                              href={`/book/tcreativestudio`}
                              className="text-[10px] tracking-widest uppercase text-foreground hover:text-accent transition-colors border border-foreground/20 hover:border-accent/40 px-3 py-2"
                            >
                              Book
                            </Link>
                          )}

                          {/* Add to cart or inquiry */}
                          {product.availability === "out_of_stock" ? (
                            <span className="text-xs text-muted">Out of stock</span>
                          ) : canAddToCart(product) ? (
                            <button
                              onClick={() =>
                                addItem({
                                  productId: product.id,
                                  title: product.title,
                                  priceInCents: product.priceInCents!,
                                  imageUrl: product.imageUrl,
                                })
                              }
                              className="text-[10px] tracking-widest uppercase text-foreground hover:text-accent transition-colors border border-foreground/20 hover:border-accent/40 px-3 py-2"
                            >
                              Add to Cart
                            </button>
                          ) : (
                            <Link
                              href={`/contact?interest=Shop+Products&product=${encodeURIComponent(product.title)}`}
                              className="text-[10px] tracking-widest uppercase text-foreground hover:text-accent transition-colors border border-foreground/20 hover:border-accent/40 px-3 py-2"
                            >
                              Inquire
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </m.div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Client portal CTA */}
        <section className="py-24 px-6 bg-surface border-t border-foreground/8">
          <div className="mx-auto max-w-3xl text-center">
            <m.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-xs tracking-widest uppercase text-muted mb-4">Client Portal</p>
              <h2 className="text-2xl md:text-3xl font-light tracking-tight text-foreground mb-4">
                Already a client?
              </h2>
              <p className="text-sm text-muted mb-8 max-w-md mx-auto">
                Log in to your client portal to add products to your cart, track orders, and pick
                them up at your next appointment.
              </p>
              <Link
                href="/dashboard/shop"
                className="inline-flex items-center justify-center px-8 py-3.5 text-xs tracking-wide uppercase bg-foreground text-background hover:bg-muted transition-colors"
              >
                Shop via Client Portal
              </Link>
            </m.div>
          </div>
        </section>
      </main>

      {/* Floating cart button */}
      {count > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-foreground text-background flex items-center justify-center shadow-lg hover:bg-muted transition-colors"
        >
          <span className="text-sm font-medium">{count}</span>
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
