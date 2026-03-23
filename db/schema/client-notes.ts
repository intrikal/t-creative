/**
 * client_notes — Communication history and internal notes per client.
 *
 * Supports manual notes (admin/staff entered), auto-logged system events
 * (email sent, SMS sent), and in-person meeting notes. Pinned notes
 * surface as yellow banners on the client detail page header.
 *
 * RLS: admin and staff can read/write. Clients CANNOT see notes.
 */
import { relations } from "drizzle-orm";
import { boolean, index, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

/** Type of note/communication entry. */
export const clientNoteTypeEnum = pgEnum("client_note_type", [
  "note",
  "call",
  "email",
  "sms",
  "in_person",
]);

/* ------------------------------------------------------------------ */
/*  Table                                                              */
/* ------------------------------------------------------------------ */

export const clientNotes = pgTable(
  "client_notes",
  {
    id: serial("id").primaryKey(),

    /** The client this note is about. */
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /** Staff member who created the note (or system for auto-logged). */
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "set null" }),

    /** What kind of interaction this records. */
    type: clientNoteTypeEnum("type").notNull().default("note"),

    /** Note body — free-text for manual notes, template name + subject for auto-logged. */
    content: text("content").notNull(),

    /** Pinned notes show as a yellow banner on the client profile header. */
    isPinned: boolean("is_pinned").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("client_notes_profile_idx").on(t.profileId),
    index("client_notes_author_idx").on(t.authorId),
    index("client_notes_type_idx").on(t.type),
    index("client_notes_pinned_idx").on(t.profileId, t.isPinned),
    index("client_notes_created_idx").on(t.profileId, t.createdAt),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const clientNotesRelations = relations(clientNotes, ({ one }) => ({
  /** The client this note is about. */
  profile: one(profiles, {
    fields: [clientNotes.profileId],
    references: [profiles.id],
    relationName: "clientNotes",
  }),
  /** The staff member who wrote the note. */
  author: one(profiles, {
    fields: [clientNotes.authorId],
    references: [profiles.id],
    relationName: "authoredNotes",
  }),
}));
