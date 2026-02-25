/**
 * messages — Internal messaging between staff and clients.
 *
 * Supports two views:
 *
 * **Admin Inbox** — Unified inbox with All/Unread/Starred/Archived tabs.
 *   Thread list shows: client name, type badge (request/inquiry), unread dot,
 *   star, subject, preview, timestamp. Detail panel shows: client contact info,
 *   booking context (date/time/service), referral note, Quick Replies templates,
 *   reply box, and Approve/Reject/Archive/Mark as Resolved actions.
 *   Status filter: Pending / New / Contacted / Approved / Rejected.
 *
 * **Client Messages** — Thread list with sender name + role (Owner/Assistant),
 *   subject, category badge (confirmation/reminder/booking), "New" badge.
 *   Clients can reply inline or start a new message (Name, Email, Phone,
 *   Subject, Message).
 *
 * Real-time delivery via Supabase Realtime subscriptions on the `messages`
 * table — no polling required.
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
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { messageChannelEnum } from "./enums";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

/**
 * Thread type — shown as a badge on the thread card in both admin
 * and client views. Determines how the thread is categorized.
 */
export const threadTypeEnum = pgEnum("thread_type", [
  "request",
  "inquiry",
  "confirmation",
  "reminder",
  "booking",
  "general",
]);

/**
 * Thread status — powers the admin "All Status" filter dropdown
 * and drives the workflow from new message → resolution.
 */
export const threadStatusEnum = pgEnum("thread_status", [
  "new",
  "pending",
  "contacted",
  "approved",
  "rejected",
  "resolved",
]);

/* ------------------------------------------------------------------ */
/*  Threads                                                            */
/* ------------------------------------------------------------------ */

/** A conversation thread between a client and the studio. */
export const threads = pgTable(
  "threads",
  {
    id: serial("id").primaryKey(),

    /** Subject line (e.g. "Booking Request: Volume Lash Set"). */
    subject: varchar("subject", { length: 300 }).notNull(),

    /** The client participant (nullable for group threads). */
    clientId: uuid("client_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),

    /** Whether this is a group thread with multiple participants. */
    isGroup: boolean("is_group").notNull().default(false),

    /** Thread category — shown as a badge (request/inquiry/confirmation/etc). */
    threadType: threadTypeEnum("thread_type").notNull().default("general"),

    /** Admin workflow status — filterable via "All Status" dropdown. */
    status: threadStatusEnum("status").notNull().default("new"),

    /** Optional link to a booking for context (shows Date/Time/Service in detail panel). */
    bookingId: integer("booking_id"),

    /** Whether this thread has been starred by staff (admin "Starred" tab). */
    isStarred: boolean("is_starred").notNull().default(false),

    /** Whether this thread has been archived (admin "Archived" tab). */
    isArchived: boolean("is_archived").notNull().default(false),

    isClosed: boolean("is_closed").notNull().default(false),

    /**
     * Staff member assigned to this thread (nullable).
     * Shown as "From Alex Martinez · Assistant" in client view.
     */
    assignedStaffId: uuid("assigned_staff_id").references(() => profiles.id, {
      onDelete: "set null",
    }),

    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("threads_client_idx").on(t.clientId),
    index("threads_status_idx").on(t.status),
    index("threads_type_idx").on(t.threadType),
    index("threads_starred_idx").on(t.isStarred),
    index("threads_archived_idx").on(t.isArchived),
    index("threads_assigned_idx").on(t.assignedStaffId),
    index("threads_last_message_idx").on(t.lastMessageAt),
  ],
);

/* ------------------------------------------------------------------ */
/*  Messages                                                           */
/* ------------------------------------------------------------------ */

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    threadId: integer("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),

    senderId: uuid("sender_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /** Nullable — null means it's a broadcast or thread-wide message. */
    recipientId: uuid("recipient_id").references(() => profiles.id, {
      onDelete: "set null",
    }),

    channel: messageChannelEnum("channel").notNull().default("internal"),

    body: text("body").notNull(),

    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_thread_idx").on(t.threadId),
    index("messages_sender_idx").on(t.senderId),
    index("messages_recipient_idx").on(t.recipientId),
    index("messages_unread_idx").on(t.recipientId, t.isRead),
  ],
);

/* ------------------------------------------------------------------ */
/*  Quick Replies (saved response templates)                           */
/* ------------------------------------------------------------------ */

/**
 * Pre-written response templates shown as "Quick Replies" pills
 * in the admin message detail panel. Trini can click a template
 * to auto-fill the reply box.
 *
 * E.g. "Thanks for your inquiry! I'll get back t..."
 *      "Your appointment request has been receiv..."
 *      "I'd love to help! Let me check my availa..."
 */
export const quickReplies = pgTable("quick_replies", {
  id: serial("id").primaryKey(),

  /** Short label shown on the pill (truncated in UI). */
  label: varchar("label", { length: 200 }).notNull(),

  /** Full response text inserted into the reply box on click. */
  body: text("body").notNull(),

  /** Display order (lower = first). */
  sortOrder: integer("sort_order").notNull().default(0),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/*  Thread Participants (for group threads)                            */
/* ------------------------------------------------------------------ */

/** Tracks which profiles participate in a thread. */
export const threadParticipants = pgTable(
  "thread_participants",
  {
    id: serial("id").primaryKey(),
    threadId: integer("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("thread_participants_thread_idx").on(t.threadId),
    index("thread_participants_profile_idx").on(t.profileId),
    uniqueIndex("thread_participants_unique_idx").on(t.threadId, t.profileId),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const threadsRelations = relations(threads, ({ one, many }) => ({
  /** Many-to-one: threads.client_id → profiles.id (the client in this conversation). */
  client: one(profiles, {
    fields: [threads.clientId],
    references: [profiles.id],
  }),
  /** Many-to-one: threads.assigned_staff_id → profiles.id (staff handling this thread). */
  assignedStaff: one(profiles, {
    fields: [threads.assignedStaffId],
    references: [profiles.id],
    relationName: "assignedThreadStaff",
  }),
  /** One-to-many: threads.id → messages.thread_id (all messages in this conversation). */
  messages: many(messages),
  /** One-to-many: threads.id → thread_participants.thread_id. */
  participants: many(threadParticipants),
}));

export const threadParticipantsRelations = relations(threadParticipants, ({ one }) => ({
  thread: one(threads, {
    fields: [threadParticipants.threadId],
    references: [threads.id],
  }),
  profile: one(profiles, {
    fields: [threadParticipants.profileId],
    references: [profiles.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  /** Many-to-one: messages.thread_id → threads.id (parent conversation). */
  thread: one(threads, {
    fields: [messages.threadId],
    references: [threads.id],
  }),
  /** Many-to-one: messages.sender_id → profiles.id (who sent this message). */
  sender: one(profiles, {
    fields: [messages.senderId],
    references: [profiles.id],
    relationName: "sender",
  }),
  /** Many-to-one: messages.recipient_id → profiles.id (who receives this message, nullable). */
  recipient: one(profiles, {
    fields: [messages.recipientId],
    references: [profiles.id],
    relationName: "recipient",
  }),
}));
