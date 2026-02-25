/**
 * PublicShopPage — Browse products from the database.
 * Supports add-to-cart for fixed-price items, inquiry links for custom quotes,
 * and dual-listed items that are also bookable as services.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Footer } from "@/components/landing/Footer";
import { useCartStore, cartTotalInCents, cartItemCount } from "@/stores/useCartStore";
import type { ShopProduct } from "./actions";

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
/*  Cart Drawer                                                        */
/* ------------------------------------------------------------------ */

function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, removeItem, updateQuantity, clearCart } = useCartStore();
  const total = cartTotalInCents(items);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
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
                  {items.map((item) => (
                    <div
                      key={item.productId}
                      className="flex gap-4 py-3 border-b border-foreground/5"
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-16 h-16 object-cover bg-surface"
                        />
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
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export function PublicShopPage({ products }: { products: ShopProduct[] }) {
  const [cartOpen, setCartOpen] = useState(false);
  const { items, addItem } = useCartStore();
  const count = cartItemCount(items);

  // Derive categories from products
  const categories = Array.from(new Set(products.map((p) => p.category)));

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
              Shop
            </motion.span>
            <motion.h1
              className="text-4xl md:text-6xl font-light tracking-tight text-foreground mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Take the studio home.
            </motion.h1>
            <motion.p
              className="text-base md:text-lg text-muted max-w-xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Aftercare products, handmade items, training packages, and studio merch. Browse below
              — no account needed.
            </motion.p>
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
                {products.map((product, i) => (
                  <motion.div
                    key={product.id}
                    className={`border border-foreground/8 flex flex-col ${product.availability === "out_of_stock" ? "opacity-60" : ""}`}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.07 }}
                  >
                    {/* Product image */}
                    {product.imageUrl ? (
                      <div className="w-full aspect-[4/3] overflow-hidden bg-surface">
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="w-full h-full object-cover"
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
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Client portal CTA */}
        <section className="py-24 px-6 bg-surface border-t border-foreground/8">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div
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
            </motion.div>
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

      <Footer />
    </>
  );
}
