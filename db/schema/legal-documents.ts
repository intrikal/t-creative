/**
 * legal-documents — Privacy Policy and Terms of Service versioning.
 *
 * Legal documents are public-facing pages that Trini can update from the
 * admin dashboard without a code deploy. Key design decisions:
 *
 * 1. **Versioned rows** — every save creates a new row. Only one row per
 *    `type` may be published at a time. Old versions are kept for
 *    compliance and audit purposes (CCPA requires you to demonstrate
 *    what policy was in effect at a given time).
 *
 * 2. **Structured sections** — content is stored as a JSONB array of
 *    `{ title, paragraphs }` objects that map directly to the section
 *    components on the public page. This avoids needing a markdown
 *    parser and lets the admin UI edit each section individually.
 *
 * 3. **Effective date** — tracks the date the policy took effect, which
 *    is displayed to visitors and is a CCPA/legal requirement.
 *
 * @example
 *   // Fetch the current published privacy policy
 *   const doc = await db.query.legalDocuments.findFirst({
 *     where: and(
 *       eq(legalDocuments.type, "privacy_policy"),
 *       eq(legalDocuments.isPublished, true),
 *     ),
 *   });
 */
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

/** A single titled section with one or more paragraphs. */
export type LegalSection = {
  /** Section heading, e.g. "1. Information We Collect" */
  title: string;
  /**
   * Body paragraphs rendered in order. Each string is one <p> block.
   * List items should be prefixed with "- " and will be rendered as <li>.
   */
  paragraphs: string[];
};

/* ------------------------------------------------------------------ */
/*  Enums                                                               */
/* ------------------------------------------------------------------ */

export const legalDocumentTypeEnum = pgEnum("legal_document_type", [
  "privacy_policy",
  "terms_of_service",
]);

/* ------------------------------------------------------------------ */
/*  Table                                                               */
/* ------------------------------------------------------------------ */

export const legalDocuments = pgTable(
  "legal_documents",
  {
    id: serial("id").primaryKey(),

    type: legalDocumentTypeEnum("type").notNull(),

    /**
     * Human-readable version label (e.g. "1.0", "1.1", "2025-03").
     * Displayed in the admin version history list.
     */
    version: varchar("version", { length: 20 }).notNull().default("1.0"),

    /**
     * Intro paragraph shown before the numbered sections.
     * Typically one or two sentences framing the document.
     */
    intro: text("intro").notNull().default(""),

    /**
     * Body of the document as an ordered array of sections.
     * Each section has a `title` and one or more `paragraphs`.
     * Stored as JSONB for structured admin editing without a markdown parser.
     */
    sections: jsonb("sections").$type<LegalSection[]>().notNull().default([]),

    /**
     * The date this version of the document takes effect.
     * Displayed to visitors as "Effective date: …" and required by CCPA.
     */
    effectiveDate: date("effective_date", { mode: "string" }).notNull(),

    /**
     * Whether this version is the one shown on the public page.
     * Only one row per `type` should have isPublished = true at a time.
     * Enforced at the application layer when publishing.
     */
    isPublished: boolean("is_published").notNull().default(false),

    /** Timestamp when this version was published (set when isPublished → true). */
    publishedAt: timestamp("published_at", { withTimezone: true }),

    /**
     * Optional notes about what changed in this version (internal only).
     * e.g. "Updated CCPA section to reflect new email address"
     */
    changeNotes: text("change_notes"),

    /** Display order for footer/legal index links (lower = first). */
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("legal_documents_type_idx").on(t.type),
    index("legal_documents_published_idx").on(t.type, t.isPublished),
    index("legal_documents_effective_date_idx").on(t.type, t.effectiveDate),
  ],
);
