"use server";

/**
 * app/dashboard/messages/actions.ts — Server actions for the Messages inbox.
 *
 * Provides all data access and mutation operations for admin, client,
 * and assistant message views. Uses the `threads` + `messages` tables
 * from db/schema/messages.ts.
 *
 * ── Tables touched ──────────────────────────────────────────────────
 *  threads            – one row per conversation (1-to-1 or group)
 *  messages           – individual chat messages; FK → threads
 *  profiles           – user identity (name, email, avatar, role)
 *  thread_participants – many-to-many join between threads and profiles
 *  quick_replies      – admin-defined canned response templates
 *  bookings           – appointment records; threads can link to a booking
 *  booking_add_ons    – optional extras attached to a booking
 *  services           – catalog of bookable services (name, price, duration)
 *
 * ── Views that consume these actions ────────────────────────────────
 *  /dashboard/messages          – admin/assistant inbox (uses getThreads)
 *  /dashboard/messages (client) – client inbox  (uses getClientThreads)
 *  Public booking page          – uses createBookingRequest
 *
 * ── External side-effects ───────────────────────────────────────────
 *  Resend (email)   – message notification emails via sendEmail()
 *  PostHog          – analytics events via trackEvent()
 *  Zoho CRM         – deal creation via createZohoDeal()
 *  Sentry           – error capture on every catch block
 *  Next.js cache    – revalidatePath() on mutations
 */

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { eq, desc, and, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import {
  threads,
  messages,
  profiles,
  quickReplies,
  services,
  bookings,
  bookingAddOns,
  threadParticipants,
} from "@/db/schema";
import { MessageNotification } from "@/emails/MessageNotification";
import { getUser, requireAdmin, requireStaff } from "@/lib/auth";
import { rruleToCadenceLabel } from "@/lib/cadence";
import { trackEvent } from "@/lib/posthog";
import { sendEmail } from "@/lib/resend";
import { createZohoDeal } from "@/lib/zoho";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ThreadStatus = "new" | "pending" | "contacted" | "approved" | "rejected" | "resolved";
export type ThreadType =
  | "request"
  | "inquiry"
  | "confirmation"
  | "reminder"
  | "booking"
  | "general";

export interface ThreadRow {
  id: number;
  subject: string;
  threadType: string;
  status: string;
  isStarred: boolean;
  isArchived: boolean;
  isClosed: boolean;
  isGroup: boolean;
  bookingId: number | null;
  lastMessageAt: Date;
  createdAt: Date;
  clientId: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAvatarUrl: string | null;
  /** Preview text from most recent message. */
  lastMessageBody: string | null;
  /** Who sent the last message. */
  lastMessageSenderId: string | null;
  /** Count of unread messages (for the current viewer). */
  unreadCount: number;
  /** Inspo/reference photo URLs uploaded by the client at booking time. */
  referencePhotoUrls: string[] | null;
}

export interface ContactRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatarUrl: string | null;
}

export interface ParticipantRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatarUrl: string | null;
}

export interface MessageRow {
  id: number;
  threadId: number;
  body: string;
  isRead: boolean;
  createdAt: Date;
  senderId: string;
  senderFirstName: string;
  senderLastName: string;
  senderRole: string | null;
  senderAvatarUrl: string | null;
}

export interface QuickReplyRow {
  id: number;
  label: string;
  body: string;
}

/* ------------------------------------------------------------------ */
/*  Threads                                                            */
/* ------------------------------------------------------------------ */

/**
 * getThreads — Admin/assistant: all threads with latest
 * message preview + client profile + unread count. Ordered by lastMessageAt desc.
 *
 * Uses LATERAL joins to compute latest message and unread count in a single query
 * instead of 3 separate round-trips.
 */
export async function getThreads(): Promise<ThreadRow[]> {
  try {
    const user = await requireAdmin();

    /*
     * ── Raw SQL query: fetch every thread with preview + unread count ──
     *
     * SELECT columns:
     *   t.*                  – thread metadata (subject, type, status, flags, timestamps)
     *   p.first_name …      – client's profile fields (name, email, phone, avatar)
     *   lm.body             – body text of the most recent message (inbox preview)
     *   lm.sender_id        – who sent that latest message (to show "You: …" vs client name)
     *   COALESCE(uc.cnt, 0) – number of unread messages in this thread for the current user
     *
     * FROM threads t
     *   LEFT JOIN profiles p        – attach the client's profile to each thread.
     *                                 LEFT because some threads may have no client (e.g. group chats).
     *                                 Matched on t.client_id = p.id.
     *
     *   LEFT JOIN LATERAL (…) lm    – a LATERAL subquery that grabs just the single newest
     *                                 message per thread (ORDER BY created_at DESC LIMIT 1).
     *                                 LATERAL lets it reference t.id from the outer query.
     *                                 LEFT so threads with zero messages still appear.
     *
     *   LEFT JOIN LATERAL (…) uc    – another LATERAL subquery that counts unread messages.
     *                                 Only counts messages NOT sent by the current user
     *                                 (sender_id != user.id) that have is_read = false.
     *                                 LEFT so threads with no unread messages return 0.
     *
     * ORDER BY t.last_message_at DESC NULLS LAST
     *   – show the most-recently-active thread first.
     *   – NULLS LAST pushes threads that have never had a message to the bottom.
     */
    const rows = await db.execute<{
      id: number;
      subject: string;
      threadType: string;
      status: string;
      isStarred: boolean;
      isArchived: boolean;
      isClosed: boolean;
      isGroup: boolean;
      bookingId: number | null;
      lastMessageAt: Date;
      createdAt: Date;
      clientId: string | null;
      referencePhotoUrls: string[] | null;
      clientFirstName: string | null;
      clientLastName: string | null;
      clientEmail: string | null;
      clientPhone: string | null;
      clientAvatarUrl: string | null;
      lastMessageBody: string | null;
      lastMessageSenderId: string | null;
      unreadCount: number;
    }>(sql`
      SELECT
        t.id,
        t.subject,
        t.thread_type AS "threadType",
        t.status,
        t.is_starred AS "isStarred",
        t.is_archived AS "isArchived",
        t.is_closed AS "isClosed",
        t.is_group AS "isGroup",
        t.booking_id AS "bookingId",
        t.last_message_at AS "lastMessageAt",
        t.created_at AS "createdAt",
        t.client_id AS "clientId",
        t.reference_photo_urls AS "referencePhotoUrls",
        p.first_name AS "clientFirstName",
        p.last_name AS "clientLastName",
        p.email AS "clientEmail",
        p.phone AS "clientPhone",
        p.avatar_url AS "clientAvatarUrl",
        lm.body AS "lastMessageBody",
        lm.sender_id AS "lastMessageSenderId",
        COALESCE(uc.cnt, 0)::int AS "unreadCount"
      FROM threads t
      LEFT JOIN profiles p ON t.client_id = p.id
      LEFT JOIN LATERAL (
        SELECT body, sender_id
        FROM messages
        WHERE thread_id = t.id
        ORDER BY created_at DESC
        LIMIT 1
      ) lm ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt
        FROM messages
        WHERE thread_id = t.id
          AND is_read = false
          AND sender_id != ${user.id}
      ) uc ON true
      ORDER BY t.last_message_at DESC NULLS LAST
      LIMIT 50
    `);

    return [...rows];
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * getClientThreads — Client view: returns all threads where the user is
 * a participant (via threadParticipants) or the legacy clientId owner.
 * Ordered by lastMessageAt desc.
 *
 * Uses LATERAL joins to compute latest message and unread count in a single query.
 */
export async function getClientThreads(): Promise<ThreadRow[]> {
  try {
    const user = await getUser();

    /*
     * ── Raw SQL query: fetch threads visible to this client ─────────
     *
     * Identical column selection to getThreads (see comments there).
     * Same LATERAL subqueries for latest-message preview and unread count.
     *
     * WHERE clause (the key difference from getThreads):
     *   t.client_id = user.id           – threads where this user is the designated client
     *   OR t.id IN (SELECT thread_id    – OR threads where this user appears in the
     *       FROM thread_participants       thread_participants join table (covers group
     *       WHERE profile_id = user.id)   chats and threads where they were added later).
     *
     * ORDER BY t.last_message_at DESC NULLS LAST
     *   – most recently active thread first; threads with no messages sink to the bottom.
     */
    const rows = await db.execute<{
      id: number;
      subject: string;
      threadType: string;
      status: string;
      isStarred: boolean;
      isArchived: boolean;
      isClosed: boolean;
      isGroup: boolean;
      bookingId: number | null;
      lastMessageAt: Date;
      createdAt: Date;
      clientId: string | null;
      referencePhotoUrls: string[] | null;
      clientFirstName: string | null;
      clientLastName: string | null;
      clientEmail: string | null;
      clientPhone: string | null;
      clientAvatarUrl: string | null;
      lastMessageBody: string | null;
      lastMessageSenderId: string | null;
      unreadCount: number;
    }>(sql`
      SELECT
        t.id,
        t.subject,
        t.thread_type AS "threadType",
        t.status,
        t.is_starred AS "isStarred",
        t.is_archived AS "isArchived",
        t.is_closed AS "isClosed",
        t.is_group AS "isGroup",
        t.booking_id AS "bookingId",
        t.last_message_at AS "lastMessageAt",
        t.created_at AS "createdAt",
        t.client_id AS "clientId",
        t.reference_photo_urls AS "referencePhotoUrls",
        p.first_name AS "clientFirstName",
        p.last_name AS "clientLastName",
        p.email AS "clientEmail",
        p.phone AS "clientPhone",
        p.avatar_url AS "clientAvatarUrl",
        lm.body AS "lastMessageBody",
        lm.sender_id AS "lastMessageSenderId",
        COALESCE(uc.cnt, 0)::int AS "unreadCount"
      FROM threads t
      LEFT JOIN profiles p ON t.client_id = p.id
      LEFT JOIN LATERAL (
        SELECT body, sender_id
        FROM messages
        WHERE thread_id = t.id
        ORDER BY created_at DESC
        LIMIT 1
      ) lm ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cnt
        FROM messages
        WHERE thread_id = t.id
          AND is_read = false
          AND sender_id != ${user.id}
      ) uc ON true
      WHERE t.client_id = ${user.id}
        OR t.id IN (
          SELECT thread_id FROM thread_participants WHERE profile_id = ${user.id}
        )
      ORDER BY t.last_message_at DESC NULLS LAST
      LIMIT 50
    `);

    return [...rows];
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Messages                                                           */
/* ------------------------------------------------------------------ */

/**
 * getThreadMessages — All messages in a thread with sender profile info.
 * Ordered by createdAt ascending (oldest first, like a chat).
 */
export async function getThreadMessages(threadId: number): Promise<MessageRow[]> {
  try {
    await getUser();

    /*
     * alias(profiles, "sender") creates a second reference to the profiles table
     * under the SQL alias "sender". This avoids a name collision if profiles is
     * joined elsewhere in the same query, and makes the generated SQL read as
     * `JOIN profiles AS sender ON …`.
     */
    const senderProfile = alias(profiles, "sender");

    /*
     * ── Drizzle query: all messages in a single thread with sender info ──
     *
     * SELECT columns:
     *   messages.id, threadId, body, isRead, createdAt, senderId
     *     – the message's own fields
     *   sender.firstName, lastName, role, avatarUrl
     *     – the profile of whoever sent the message (for rendering avatar + name)
     *
     * FROM messages
     *   INNER JOIN profiles AS sender ON messages.sender_id = sender.id
     *     – INNER because every message must have a valid sender; if the sender
     *       profile were somehow missing we do NOT want to show a ghost message.
     *
     * WHERE messages.thread_id = threadId
     *   – restrict to the one thread the user clicked on.
     *
     * ORDER BY messages.created_at ASC (default ascending)
     *   – chronological order, oldest first, so the chat reads top-to-bottom.
     */
    const rows = await db
      .select({
        id: messages.id,
        threadId: messages.threadId,
        body: messages.body,
        isRead: messages.isRead,
        createdAt: messages.createdAt,
        senderId: messages.senderId,
        senderFirstName: senderProfile.firstName,
        senderLastName: senderProfile.lastName,
        senderRole: senderProfile.role,
        senderAvatarUrl: senderProfile.avatarUrl,
      })
      .from(messages)
      .innerJoin(senderProfile, eq(messages.senderId, senderProfile.id))
      .where(eq(messages.threadId, threadId))
      .orderBy(messages.createdAt);

    return rows;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * sendMessage — Insert a new message into a thread and update the
 * thread's lastMessageAt timestamp.
 *
 * ── Side-effects ────────────────────────────────────────────────────
 *  1. INSERT into messages table (the new message row).
 *  2. UPDATE threads.last_message_at so the thread bubbles to the top of the inbox.
 *  3. If the thread's status is "new" and an admin/assistant is replying (not the
 *     client), the status auto-advances to "contacted".
 *  4. Email notification sent to every OTHER participant in the thread who has
 *     notifyEmail enabled (non-fatal — failure is silently caught).
 *  5. revalidatePath("/dashboard/messages") — purges the Next.js cache so the
 *     inbox list re-fetches on next navigation.
 *  6. PostHog analytics event "message_sent".
 */
export async function sendMessage(threadId: number, body: string): Promise<MessageRow> {
  try {
    z.number().int().positive().parse(threadId);
    z.string().min(1).parse(body);
    const user = await requireStaff();

    /* alias() creates a table alias so we can join profiles twice if needed. */
    const senderProfile = alias(profiles, "sender");

    /*
     * INSERT into messages — creates the new message row.
     * channel: "internal" means this is an in-app message (as opposed to SMS/email).
     * .returning() gives back the full inserted row so we have the auto-generated id.
     */
    const [msg] = await db
      .insert(messages)
      .values({
        threadId,
        senderId: user.id,
        body,
        channel: "internal",
      })
      .returning();

    /*
     * UPDATE threads — bump last_message_at to NOW so this thread sorts to the
     * top of the inbox list (getThreads orders by last_message_at DESC).
     * WHERE: only the single thread we are posting to.
     */
    // Update thread timestamp
    await db.update(threads).set({ lastMessageAt: new Date() }).where(eq(threads.id, threadId));

    /*
     * SELECT threads.status and threads.client_id for just this thread.
     * Used to decide whether to auto-advance the thread status.
     */
    // If admin is replying to a "new" thread, auto-move to "contacted"
    const [thread] = await db
      .select({ status: threads.status, clientId: threads.clientId })
      .from(threads)
      .where(eq(threads.id, threadId));

    /*
     * Auto-status transition: if the thread was "new" and the person replying
     * is NOT the client (i.e. an admin or assistant is responding), move the
     * status to "contacted" so the inbox reflects that the team has responded.
     */
    if (thread && thread.clientId && thread.clientId !== user.id && thread.status === "new") {
      await db.update(threads).set({ status: "contacted" }).where(eq(threads.id, threadId));
    }

    /*
     * Re-fetch the just-inserted message joined with the sender's profile.
     *
     * SELECT: message fields + sender's first name, last name, role, avatar.
     * INNER JOIN profiles AS sender ON messages.sender_id = sender.id
     *   – INNER because we know the sender exists (it's the current user).
     * WHERE messages.id = msg.id — the single message we just inserted.
     *
     * This is returned to the caller so the UI can optimistically render the
     * new message with full sender info without a separate round-trip.
     */
    // Fetch full message with sender info
    const [full] = await db
      .select({
        id: messages.id,
        threadId: messages.threadId,
        body: messages.body,
        isRead: messages.isRead,
        createdAt: messages.createdAt,
        senderId: messages.senderId,
        senderFirstName: senderProfile.firstName,
        senderLastName: senderProfile.lastName,
        senderRole: senderProfile.role,
        senderAvatarUrl: senderProfile.avatarUrl,
      })
      .from(messages)
      .innerJoin(senderProfile, eq(messages.senderId, senderProfile.id))
      .where(eq(messages.id, msg.id));

    // Send email notification to other thread participants (non-fatal)
    try {
      // Combine first and last name into a display string, filtering out nulls/
      // empty strings so we don't get leading/trailing spaces (e.g. when lastName
      // is null the result is just "Trini", not "Trini ").
      const senderName = [full.senderFirstName, full.senderLastName].filter(Boolean).join(" ");

      /*
       * SELECT participant profiles for this thread.
       *
       * SELECT: profiles.id, email, firstName, notifyEmail
       *   – id to skip the sender; email to deliver the notification;
       *     firstName for the greeting; notifyEmail (boolean) to honour opt-out.
       *
       * FROM thread_participants
       *   INNER JOIN profiles ON thread_participants.profile_id = profiles.id
       *     – INNER because a participant row without a valid profile is orphaned
       *       data and should not receive an email.
       *
       * WHERE thread_participants.thread_id = threadId
       *   – only participants of this specific thread.
       */
      const participants = await db
        .select({
          id: profiles.id,
          email: profiles.email,
          firstName: profiles.firstName,
          notifyEmail: profiles.notifyEmail,
        })
        .from(threadParticipants)
        .innerJoin(profiles, eq(threadParticipants.profileId, profiles.id))
        .where(eq(threadParticipants.threadId, threadId));

      /*
       * SELECT threads.subject — just the subject line, used in the email subject
       * and body. WHERE matches the single thread by id.
       */
      // Get thread subject
      const [threadRow] = await db
        .select({ subject: threads.subject })
        .from(threads)
        .where(eq(threads.id, threadId));

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const preview = body.length > 200 ? body.slice(0, 200) + "..." : body;
      const bp = await getPublicBusinessProfile();

      for (const p of participants) {
        if (p.id === user.id) continue; // Don't email yourself
        if (!p.email || !p.notifyEmail) continue;
        await sendEmail({
          to: p.email,
          subject: `New message — ${threadRow?.subject ?? "Conversation"} — ${bp.businessName}`,
          react: MessageNotification({
            recipientName: p.firstName,
            senderName,
            threadSubject: threadRow?.subject ?? "Conversation",
            messagePreview: preview,
            threadUrl: `${siteUrl}/dashboard/messages?thread=${threadId}`,
            businessName: bp.businessName,
          }),
          entityType: "message_notification",
          localId: String(msg.id),
        });
      }
    } catch {
      // Non-fatal
    }

    revalidatePath("/dashboard/messages");
    trackEvent(user.id, "message_sent", { threadId });
    return full;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * markThreadRead — Mark all messages in a thread as read for the current user.
 * Only marks messages NOT sent by the current user (you can't "read" your own messages).
 */
export async function markThreadRead(threadId: number): Promise<void> {
  try {
    z.number().int().positive().parse(threadId);
    const user = await requireStaff();

    /*
     * UPDATE messages — bulk-mark messages as read.
     *
     * SET: isRead = true, readAt = NOW()
     *
     * WHERE (three conditions ANDed together):
     *   messages.thread_id = threadId   – only messages in this thread
     *   messages.sender_id != user.id   – skip messages the current user sent
     *                                     (you don't "read" your own messages)
     *   messages.is_read = false        – only touch unread rows, avoids
     *                                     overwriting the original readAt timestamp
     */
    await db
      .update(messages)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(messages.threadId, threadId),
          ne(messages.senderId, user.id),
          eq(messages.isRead, false),
        ),
      );
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Thread admin actions                                               */
/* ------------------------------------------------------------------ */

/**
 * updateThreadStatus — Admin sets a thread's workflow status.
 *
 * UPDATE threads SET status = :status WHERE id = :threadId
 *
 * Side-effects: revalidatePath("/dashboard/messages") to bust the Next.js cache.
 */
export async function updateThreadStatus(threadId: number, status: ThreadStatus): Promise<void> {
  try {
    z.number().int().positive().parse(threadId);
    z.enum(["new", "pending", "contacted", "approved", "rejected", "resolved"]).parse(status);
    await requireAdmin();
    await db.update(threads).set({ status }).where(eq(threads.id, threadId));
    revalidatePath("/dashboard/messages");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * toggleThreadStar — Flip the is_starred flag on a thread (star/unstar).
 *
 * Step 1: SELECT threads.is_starred WHERE id = threadId — read current value.
 * Step 2: UPDATE threads SET is_starred = !current WHERE id = threadId — toggle.
 *
 * Side-effects: revalidatePath("/dashboard/messages").
 */
export async function toggleThreadStar(threadId: number): Promise<void> {
  try {
    z.number().int().positive().parse(threadId);
    await requireAdmin();
    const [thread] = await db
      .select({ isStarred: threads.isStarred })
      .from(threads)
      .where(eq(threads.id, threadId));
    if (thread) {
      await db
        .update(threads)
        .set({ isStarred: !thread.isStarred })
        .where(eq(threads.id, threadId));
    }
    revalidatePath("/dashboard/messages");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * archiveThread — Soft-archive a thread (it stays in the DB but is hidden from the default inbox view).
 *
 * UPDATE threads SET is_archived = true WHERE id = :threadId
 *
 * Side-effects: revalidatePath("/dashboard/messages").
 */
export async function archiveThread(threadId: number): Promise<void> {
  try {
    z.number().int().positive().parse(threadId);
    await requireAdmin();
    await db.update(threads).set({ isArchived: true }).where(eq(threads.id, threadId));
    revalidatePath("/dashboard/messages");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * unarchiveThread — Restore an archived thread back to the active inbox.
 *
 * UPDATE threads SET is_archived = false WHERE id = :threadId
 *
 * Side-effects: revalidatePath("/dashboard/messages").
 */
export async function unarchiveThread(threadId: number): Promise<void> {
  try {
    z.number().int().positive().parse(threadId);
    await requireAdmin();
    await db.update(threads).set({ isArchived: false }).where(eq(threads.id, threadId));
    revalidatePath("/dashboard/messages");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Quick Replies                                                      */
/* ------------------------------------------------------------------ */

/**
 * getQuickReplies — Fetch the list of canned response templates the admin can
 * insert into a message with one click.
 *
 * SELECT: id, label (short display name), body (full template text)
 * FROM quick_replies
 * WHERE is_active = true   – only show templates that haven't been soft-deleted
 * ORDER BY sort_order ASC  – admin-defined display order
 */
export async function getQuickReplies(): Promise<QuickReplyRow[]> {
  try {
    await requireAdmin();
    return db
      .select({ id: quickReplies.id, label: quickReplies.label, body: quickReplies.body })
      .from(quickReplies)
      .where(eq(quickReplies.isActive, true))
      .orderBy(quickReplies.sortOrder);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Contacts & Thread creation                                         */
/* ------------------------------------------------------------------ */

/**
 * getVisibleContacts — Returns all profiles the current user can message.
 * Excludes the current user from the list.
 */
export async function getVisibleContacts(): Promise<ContactRow[]> {
  try {
    const user = await requireAdmin();

    /*
     * SELECT: id, firstName, lastName, email, role, avatarUrl
     *   – all fields needed to render a contact picker chip (avatar + name + role badge).
     *
     * FROM profiles
     * WHERE profiles.id != user.id  – exclude the current user (you can't message yourself).
     * ORDER BY profiles.first_name ASC – alphabetical for the dropdown/autocomplete.
     */
    const rows = await db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        email: profiles.email,
        role: profiles.role,
        avatarUrl: profiles.avatarUrl,
      })
      .from(profiles)
      .where(ne(profiles.id, user.id))
      .orderBy(profiles.firstName);

    return rows;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * createThread — Create a new conversation thread with one or more participants.
 * Sets clientId for single-client threads; null for group threads.
 *
 * ── Side-effects ────────────────────────────────────────────────────
 *  1. INSERT into threads (the conversation envelope).
 *  2. INSERT into thread_participants (one row per participant + the sender).
 *  3. INSERT into messages (the initial message body).
 *  4. PostHog analytics event "thread_created".
 *  5. revalidatePath("/dashboard/messages").
 */
const createThreadSchema = z.object({
  subject: z.string().min(1),
  participantIds: z.array(z.string().min(1)).min(1),
  body: z.string().min(1),
});

export async function createThread(input: {
  subject: string;
  participantIds: string[];
  body: string;
}): Promise<{ threadId: number }> {
  try {
    createThreadSchema.parse(input);
    const user = await requireStaff();

    const isGroup = input.participantIds.length > 1;

    /*
     * For 1-to-1 threads, look up the participant's role.
     * SELECT profiles.role WHERE id = participantIds[0]
     * If they are a "client", store their id as threads.client_id so the
     * getThreads query can LEFT JOIN to show client info in the inbox row.
     * Group threads leave client_id NULL.
     */
    // For single-participant threads, check if the participant is a client
    let clientId: string | null = null;
    if (!isGroup && input.participantIds.length === 1) {
      const [participant] = await db
        .select({ role: profiles.role })
        .from(profiles)
        .where(eq(profiles.id, input.participantIds[0]));
      if (participant?.role === "client") {
        clientId = input.participantIds[0];
      }
    }

    /*
     * INSERT into threads — creates the conversation envelope.
     * thread_type defaults to "general"; status starts at "new".
     * .returning({ id }) gives us the auto-generated thread id for the follow-up inserts.
     */
    const [thread] = await db
      .insert(threads)
      .values({
        subject: input.subject,
        clientId,
        isGroup,
        threadType: "general",
        status: "new",
      })
      .returning({ id: threads.id });

    /*
     * INSERT into thread_participants — one row per participant.
     * Uses a Set to deduplicate in case the sender is also in participantIds.
     */
    // Add all participants + the sender
    const allParticipantIds = new Set([...input.participantIds, user.id]);
    // Convert the deduplicated Set of participant IDs into an array of insert
    // objects for the thread_participants join table. Spreading the Set into an
    // array is required because Set is not directly iterable by Drizzle's
    // .values(). Each entry links a profile to this thread.
    await db.insert(threadParticipants).values(
      [...allParticipantIds].map((profileId) => ({
        threadId: thread.id,
        profileId,
      })),
    );

    /*
     * INSERT into messages — the first message in the new thread.
     * channel: "internal" marks it as an in-app message.
     */
    // Insert initial message
    await db.insert(messages).values({
      threadId: thread.id,
      senderId: user.id,
      body: input.body,
      channel: "internal" as const,
    });

    trackEvent(user.id, "thread_created", {
      subject: input.subject,
      isGroup,
      participantCount: input.participantIds.length,
    });
    revalidatePath("/dashboard/messages");
    return { threadId: thread.id };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * getThreadParticipants — Returns participant profiles for a thread.
 *
 * SELECT: profiles.id, firstName, lastName, email, role, avatarUrl
 *   – everything needed to render participant avatars and a "members" list.
 *
 * FROM thread_participants
 *   INNER JOIN profiles ON thread_participants.profile_id = profiles.id
 *     – INNER because a participant row without a matching profile is invalid data
 *       and should not appear in the list.
 *
 * WHERE thread_participants.thread_id = :threadId
 *   – only participants belonging to the requested thread.
 */
export async function getThreadParticipants(threadId: number): Promise<ParticipantRow[]> {
  try {
    await requireAdmin();

    const rows = await db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        email: profiles.email,
        role: profiles.role,
        avatarUrl: profiles.avatarUrl,
      })
      .from(threadParticipants)
      .innerJoin(profiles, eq(threadParticipants.profileId, profiles.id))
      .where(eq(threadParticipants.threadId, threadId));

    return rows;
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Booking request (public-facing)                                    */
/* ------------------------------------------------------------------ */

/**
 * createBookingRequest — Called from the public booking page when a client
 * submits a booking request. Creates a pending booking + a message thread
 * so the admin sees it as a new conversation in their inbox.
 *
 * Requires the client to be authenticated (logged in).
 */
const addOnItemSchema = z.object({
  name: z.string().min(1),
  priceInCents: z.number().int().nonnegative(),
});

const createBookingRequestSchema = z.object({
  serviceId: z.number().int().positive(),
  message: z.string(),
  preferredDates: z.string().optional(),
  referencePhotoUrls: z.array(z.string()).optional(),
  recurrenceRule: z.string().optional(),
  selectedAddOns: z.array(addOnItemSchema).optional(),
  tosAccepted: z.literal(true),
  tosVersion: z.string().min(1),
});

export async function createBookingRequest(input: {
  serviceId: number;
  message: string;
  preferredDates?: string;
  referencePhotoUrls?: string[];
  recurrenceRule?: string;
  selectedAddOns?: { name: string; priceInCents: number }[];
  tosAccepted: true;
  tosVersion: string;
}): Promise<{ threadId: number; bookingId: number }> {
  createBookingRequestSchema.parse(input);
  const user = await getUser();

  /*
   * SELECT: services.name, durationMinutes, priceInCents
   * FROM services WHERE id = :serviceId
   *
   * Fetches the service catalog entry so we know the name (for the thread
   * subject line), the default duration, and the base price for the booking.
   */
  // Get the service name for the thread subject
  const [service] = await db
    .select({
      name: services.name,
      durationMinutes: services.durationMinutes,
      priceInCents: services.priceInCents,
    })
    .from(services)
    .where(eq(services.id, input.serviceId));

  if (!service) throw new Error("Service not found");

  /*
   * INSERT into bookings — creates a "pending" booking record.
   * staffId is NULL because no staff member has been assigned yet.
   * startsAt is a placeholder (NOW); the admin will set the real appointment time.
   * clientNotes concatenates preferred dates + recurrence label + free-text message.
   * .returning({ id }) gives us the booking id for linking to the thread + add-ons.
   */
  // Create a pending booking
  const cadenceLabel = input.recurrenceRule ? rruleToCadenceLabel(input.recurrenceRule) : null;
  const cookieStore = await cookies();
  const referrerCode = cookieStore.get("referral_ref")?.value?.trim() || null;
  const [booking] = await db
    .insert(bookings)
    .values({
      clientId: user.id,
      serviceId: input.serviceId,
      staffId: null,
      status: "pending",
      startsAt: new Date(), // Placeholder — admin will set actual time
      durationMinutes: service.durationMinutes ?? 60,
      totalInCents: service.priceInCents ?? 0,
      recurrenceRule: input.recurrenceRule || null,
      tosAcceptedAt: new Date(),
      tosVersion: input.tosVersion,
      referrerCode,
      // Assemble client notes from optional pieces: preferred dates, recurrence
      // label, and free-text message. Nulls represent missing pieces; .filter(Boolean)
      // strips them so .join() only produces separators between actual content.
      // This pattern avoids messy conditional string concatenation.
      clientNotes: [
        input.preferredDates ? `Preferred dates: ${input.preferredDates}` : null,
        cadenceLabel ? `Recurring: ${cadenceLabel}` : null,
        input.message || null,
      ]
        .filter(Boolean)
        .join("\n\n"),
    })
    .returning({ id: bookings.id });

  /*
   * INSERT into booking_add_ons — snapshot of each selected add-on at its
   * current price. One row per add-on, linked to the booking by bookingId.
   * Stored as a snapshot so price changes later don't affect this booking.
   */
  // Store selected add-ons as snapshots on the booking
  if (input.selectedAddOns && input.selectedAddOns.length > 0) {
    // Transform each selected add-on into a booking_add_ons insert row,
    // snapshotting the name and price at booking time. Stored as separate rows
    // (not a JSON column) so they can be queried and aggregated in SQL.
    await db.insert(bookingAddOns).values(
      input.selectedAddOns.map((a) => ({
        bookingId: booking.id,
        addOnName: a.name,
        priceInCents: a.priceInCents,
      })),
    );
  }

  /*
   * INSERT into threads — creates the conversation thread linked to this booking.
   * thread_type = "request" so the inbox can filter booking requests from general chats.
   * booking_id links the thread to the booking for cross-navigation.
   * reference_photo_urls stores inspo/reference photos uploaded by the client.
   */
  // Create a thread linked to the booking
  const [thread] = await db
    .insert(threads)
    .values({
      subject: `Booking Request: ${service.name}`,
      clientId: user.id,
      threadType: "request",
      status: "new",
      bookingId: booking.id,
      referencePhotoUrls:
        input.referencePhotoUrls && input.referencePhotoUrls.length > 0
          ? input.referencePhotoUrls
          : null,
    })
    .returning({ id: threads.id });

  /*
   * INSERT into messages — the client's opening message in the new thread.
   * Body is assembled from a greeting + add-on list + preferred dates +
   * recurrence label + free-text message, joined by double newlines.
   */
  // Insert the client's initial message
  const bodyParts = [`Hi! I'd love to book a ${service.name}.`];
  if (input.selectedAddOns && input.selectedAddOns.length > 0) {
    // Format each add-on as "Name (+$Price)" and join into a comma-separated
    // string for the human-readable message body the admin will see in the inbox.
    const addOnList = input.selectedAddOns
      .map((a) => `${a.name} (+$${(a.priceInCents / 100).toFixed(0)})`)
      .join(", ");
    bodyParts.push(`Add-ons: ${addOnList}`);
  }
  if (input.preferredDates) bodyParts.push(`Preferred dates: ${input.preferredDates}`);
  if (cadenceLabel) bodyParts.push(`Repeat: ${cadenceLabel}`);
  if (input.message) bodyParts.push(input.message);
  const body = bodyParts.join("\n\n");

  await db.insert(messages).values({
    threadId: thread.id,
    senderId: user.id,
    body,
    channel: "internal",
  });

  trackEvent(user.id, "booking_request_submitted", {
    serviceId: input.serviceId,
    serviceName: service.name,
    bookingId: booking.id,
    hasPreferredDates: !!input.preferredDates,
  });

  /*
   * Side-effect: create a CRM deal in Zoho so the sales pipeline reflects
   * the new request. Fire-and-forget (not awaited) — failure won't block the response.
   */
  // Zoho CRM: create deal for the booking request
  createZohoDeal({
    contactEmail: user.email!,
    dealName: `${service.name} — Booking Request`,
    stage: "Request Submitted",
    amountInCents: service.priceInCents ?? undefined,
    bookingId: booking.id,
  });

  revalidatePath("/dashboard/messages");
  revalidatePath("/dashboard/bookings");

  return { threadId: thread.id, bookingId: booking.id };
}
