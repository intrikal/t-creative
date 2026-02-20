/**
 * wishlists — Client saved/favorited products.
 *
 * Clients browsing the marketplace can save products to revisit later.
 * The client portal shows a "Saved Items" or "Wishlist" section with
 * their favorited products. Also useful for Trini to see demand signals
 * — products with many saves may warrant being featured or restocked.
 */
import { relations } from "drizzle-orm";
import { index, integer, pgTable, serial, timestamp, uuid } from "drizzle-orm/pg-core";
import { products } from "./products";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Wishlist Items                                                     */
/* ------------------------------------------------------------------ */

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: serial("id").primaryKey(),

    /** The client who saved this product. Cascade-deletes when profile is removed. */
    clientId: uuid("client_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /** The saved product. Cascade-deletes when product is removed from catalog. */
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),

    /** When the client saved this product — used for "Recently Saved" ordering. */
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("wishlist_client_idx").on(t.clientId),
    index("wishlist_product_idx").on(t.productId),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const wishlistItemsRelations = relations(wishlistItems, ({ one }) => ({
  /** Many-to-one: many wishlist items belong to one client (wishlist_items.client_id → profiles.id). */
  client: one(profiles, {
    fields: [wishlistItems.clientId],
    references: [profiles.id],
  }),
  /** Many-to-one: many wishlist items reference one product (wishlist_items.product_id → products.id). */
  product: one(products, {
    fields: [wishlistItems.productId],
    references: [products.id],
  }),
}));
