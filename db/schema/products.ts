/**
 * products — Marketplace product catalog.
 *
 * Trini's handmade product store — primarily crochet items (sweaters,
 * blankets, bags) but extensible to lash aftercare kits, jewelry care
 * products, etc.
 *
 * Products can be ready-made (in stock) or custom order (made to order).
 * The "Create Product" modal in the admin Marketplace view maps directly
 * to this table's columns.
 *
 * Dashboard metrics (Total Products, Low Stock, Featured, Revenue,
 * Conversion Rate) are aggregated from this table + product_orders.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

/** Whether the product is custom-made or ready to ship. */
export const productTypeEnum = pgEnum("product_type", ["custom_order", "ready_made"]);

/** How the product is priced. */
export const pricingTypeEnum = pgEnum("pricing_type", [
  "fixed_price",
  "price_range",
  "contact_for_quote",
]);

/** Stock / availability status — filters on the marketplace grid. */
export const productAvailabilityEnum = pgEnum("product_availability", [
  "in_stock",
  "made_to_order",
  "pre_order",
  "out_of_stock",
]);

/* ------------------------------------------------------------------ */
/*  Products                                                           */
/* ------------------------------------------------------------------ */

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),

    title: varchar("title", { length: 300 }).notNull(),
    slug: varchar("slug", { length: 300 }).notNull().unique(),
    description: text("description"),

    productType: productTypeEnum("product_type").notNull(),

    /**
     * Product category — free-form marketplace categories like
     * "Blankets", "Accessories", "Clothing", "Bags", "Home Decor".
     * Not the same as the 4 service zones (lash/jewelry/crochet/consulting).
     */
    category: varchar("category", { length: 100 }).notNull(),

    pricingType: pricingTypeEnum("pricing_type").notNull().default("fixed_price"),

    /** Fixed price in cents. Used when pricingType is "fixed_price". */
    priceInCents: integer("price_in_cents"),

    /** Lower bound in cents. Used when pricingType is "price_range". */
    priceMinInCents: integer("price_min_in_cents"),

    /** Upper bound in cents. Used when pricingType is "price_range". */
    priceMaxInCents: integer("price_max_in_cents"),

    availability: productAvailabilityEnum("availability").notNull().default("made_to_order"),

    /** Estimated production/delivery time (e.g. "2-3 weeks"). */
    leadTime: varchar("lead_time", { length: 100 }),

    /** Current stock count. Only relevant for ready_made / in_stock items. */
    stockCount: integer("stock_count").notNull().default(0),

    /** Threshold below which this product appears in "Low Stock Items". */
    lowStockThreshold: integer("low_stock_threshold").notNull().default(3),

    /** Comma-separated tags for search/filtering (e.g. "baby, blanket, custom"). */
    tags: text("tags"),

    /** Page view counter for the Analytics tab's "Top Performing Products". */
    viewCount: integer("view_count").notNull().default(0),

    /** Whether shown in the "Featured Products" section on the marketplace. */
    isFeatured: boolean("is_featured").notNull().default(false),

    /** Whether visible on the public marketplace. */
    isPublished: boolean("is_published").notNull().default(true),

    /** Square catalog item ID — synced for checkout via Square. */
    squareCatalogId: varchar("square_catalog_id", { length: 100 }),

    /** Primary image path in Supabase Storage. */
    imageStoragePath: text("image_storage_path"),

    /** Public CDN URL (cached from storage path). */
    imageUrl: text("image_url"),

    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("products_category_idx").on(t.category),
    index("products_type_idx").on(t.productType),
    index("products_availability_idx").on(t.availability),
    index("products_featured_idx").on(t.isFeatured),
    index("products_published_idx").on(t.isPublished),
    index("products_square_id_idx").on(t.squareCatalogId),
  ],
);

/* ------------------------------------------------------------------ */
/*  Product Images (gallery)                                           */
/* ------------------------------------------------------------------ */

/** Additional images beyond the primary product image. */
export const productImages = pgTable(
  "product_images",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),

    storagePath: text("storage_path").notNull(),
    publicUrl: text("public_url"),
    altText: varchar("alt_text", { length: 300 }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const productsRelations = relations(products, ({ many }) => ({
  /** One-to-many: one product has many gallery images (products.id → product_images.product_id). */
  images: many(productImages),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  /** Many-to-one: many images belong to one product (product_images.product_id → products.id). */
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));
