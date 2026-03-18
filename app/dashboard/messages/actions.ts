"use server";

/**
 * app/dashboard/messages/actions.ts — Server actions for the Messages inbox.
 *
 * Provides all data access and mutation operations for admin, client,
 * and assistant message views. Uses the `threads` + `messages` tables
 * from db/schema/messages.ts.
 */

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, desc, and, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
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
import { trackEvent } from "@/lib/posthog";
import { rruleToCadenceLabel } from "@/lib/cadence";
import { sendEmail } from "@/lib/resend";
import { createZohoDeal } from "@/lib/zoho";
import { createClient } from "@/utils/supabase/server";

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
/*  Auth helper                                                        */
/* ------------------------------------------------------------------ */

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/* ------------------------------------------------------------------ */
/*  Threads                                                            */
/* ------------------------------------------------------------------ */

/**
 * getThreads — Admin/assistant: all non-archived threads with latest
 * message preview + client profile + unread count. Ordered by lastMessageAt desc.
 */
export async function getThreads(): Promise<ThreadRow[]> {
  try {
    const user = await getUser();

    // Fetch threads with optional client profile (nullable for group threads)
    const threadRows = await db
      .select({
        id: threads.id,
        subject: threads.subject,
        threadType: threads.threadType,
        status: threads.status,
        isStarred: threads.isStarred,
        isArchived: threads.isArchived,
        isClosed: threads.isClosed,
        isGroup: threads.isGroup,
        bookingId: threads.bookingId,
        lastMessageAt: threads.lastMessageAt,
        createdAt: threads.createdAt,
        clientId: threads.clientId,
        clientFirstName: profiles.firstName,
        clientLastName: profiles.lastName,
        clientEmail: profiles.email,
        clientPhone: profiles.phone,
        clientAvatarUrl: profiles.avatarUrl,
        referencePhotoUrls: threads.referencePhotoUrls,
      })
      .from(threads)
      .leftJoin(profiles, eq(threads.clientId, profiles.id))
      .orderBy(desc(threads.lastMessageAt));

    if (threadRows.length === 0) return [];

    const threadIds = threadRows.map((t) => t.id);

    // Latest message per thread (use DISTINCT ON for correct results)
    const latestMessages = await db.execute<{
      thread_id: number;
      body: string;
      sender_id: string;
    }>(sql`
      SELECT DISTINCT ON (thread_id) thread_id, body, sender_id
      FROM messages
      WHERE thread_id = ANY(ARRAY[${sql.join(
        threadIds.map((id) => sql`${id}`),
        sql`, `,
      )}]::int[])
      ORDER BY thread_id, created_at DESC
    `);

    const latestByThread = new Map(
      [...latestMessages].map((r) => [r.thread_id, { body: r.body, senderId: r.sender_id }]),
    );

    // Unread count per thread (messages not sent by current user)
    const unreadCounts = await db.execute<{ thread_id: number; cnt: string }>(sql`
      SELECT thread_id, COUNT(*) as cnt
      FROM messages
      WHERE thread_id = ANY(ARRAY[${sql.join(
        threadIds.map((id) => sql`${id}`),
        sql`, `,
      )}]::int[])
        AND is_read = false
        AND sender_id != ${user.id}
      GROUP BY thread_id
    `);

    const unreadByThread = new Map([...unreadCounts].map((r) => [r.thread_id, Number(r.cnt)]));

    return threadRows.map((t) => ({
      ...t,
      lastMessageBody: latestByThread.get(t.id)?.body ?? null,
      lastMessageSenderId: latestByThread.get(t.id)?.senderId ?? null,
      unreadCount: unreadByThread.get(t.id) ?? 0,
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * getClientThreads — Client view: returns all threads where the user is
 * a participant (via threadParticipants) or the legacy clientId owner.
 * Ordered by lastMessageAt desc.
 */
export async function getClientThreads(): Promise<ThreadRow[]> {
  try {
    const user = await getUser();

    // Get thread IDs where user is a participant
    const participantRows = await db
      .select({ threadId: threadParticipants.threadId })
      .from(threadParticipants)
      .where(eq(threadParticipants.profileId, user.id));

    const participantThreadIds = participantRows.map((r) => r.threadId);

    // Fetch threads where user is clientId OR participant
    const threadRows = await db
      .select({
        id: threads.id,
        subject: threads.subject,
        threadType: threads.threadType,
        status: threads.status,
        isStarred: threads.isStarred,
        isArchived: threads.isArchived,
        isClosed: threads.isClosed,
        isGroup: threads.isGroup,
        bookingId: threads.bookingId,
        lastMessageAt: threads.lastMessageAt,
        createdAt: threads.createdAt,
        clientId: threads.clientId,
        clientFirstName: profiles.firstName,
        clientLastName: profiles.lastName,
        clientEmail: profiles.email,
        clientPhone: profiles.phone,
        clientAvatarUrl: profiles.avatarUrl,
        referencePhotoUrls: threads.referencePhotoUrls,
      })
      .from(threads)
      .leftJoin(profiles, eq(threads.clientId, profiles.id))
      .where(
        participantThreadIds.length > 0
          ? sql`(${threads.clientId} = ${user.id} OR ${threads.id} = ANY(ARRAY[${sql.join(
              participantThreadIds.map((id) => sql`${id}`),
              sql`, `,
            )}]::int[]))`
          : eq(threads.clientId, user.id),
      )
      .orderBy(desc(threads.lastMessageAt));

    if (threadRows.length === 0) return [];

    const threadIds = threadRows.map((t) => t.id);

    const latestMessages = await db.execute<{
      thread_id: number;
      body: string;
      sender_id: string;
    }>(sql`
      SELECT DISTINCT ON (thread_id) thread_id, body, sender_id
      FROM messages
      WHERE thread_id = ANY(ARRAY[${sql.join(
        threadIds.map((id) => sql`${id}`),
        sql`, `,
      )}]::int[])
      ORDER BY thread_id, created_at DESC
    `);

    const latestByThread = new Map(
      [...latestMessages].map((r) => [r.thread_id, { body: r.body, senderId: r.sender_id }]),
    );

    const unreadCounts = await db.execute<{ thread_id: number; cnt: string }>(sql`
      SELECT thread_id, COUNT(*) as cnt
      FROM messages
      WHERE thread_id = ANY(ARRAY[${sql.join(
        threadIds.map((id) => sql`${id}`),
        sql`, `,
      )}]::int[])
        AND is_read = false
        AND sender_id != ${user.id}
      GROUP BY thread_id
    `);

    const unreadByThread = new Map([...unreadCounts].map((r) => [r.thread_id, Number(r.cnt)]));

    return threadRows.map((t) => ({
      ...t,
      lastMessageBody: latestByThread.get(t.id)?.body ?? null,
      lastMessageSenderId: latestByThread.get(t.id)?.senderId ?? null,
      unreadCount: unreadByThread.get(t.id) ?? 0,
    }));
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

    const senderProfile = alias(profiles, "sender");

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
 */
export async function sendMessage(threadId: number, body: string): Promise<MessageRow> {
  try {
    z.number().int().positive().parse(threadId);
    z.string().min(1).parse(body);
    const user = await getUser();

    const senderProfile = alias(profiles, "sender");

    const [msg] = await db
      .insert(messages)
      .values({
        threadId,
        senderId: user.id,
        body,
        channel: "internal",
      })
      .returning();

    // Update thread timestamp
    await db.update(threads).set({ lastMessageAt: new Date() }).where(eq(threads.id, threadId));

    // If admin is replying to a "new" thread, auto-move to "contacted"
    const [thread] = await db
      .select({ status: threads.status, clientId: threads.clientId })
      .from(threads)
      .where(eq(threads.id, threadId));

    if (thread && thread.clientId && thread.clientId !== user.id && thread.status === "new") {
      await db.update(threads).set({ status: "contacted" }).where(eq(threads.id, threadId));
    }

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
      const senderName = [full.senderFirstName, full.senderLastName].filter(Boolean).join(" ");
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

      // Get thread subject
      const [threadRow] = await db
        .select({ subject: threads.subject })
        .from(threads)
        .where(eq(threads.id, threadId));

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const preview = body.length > 200 ? body.slice(0, 200) + "..." : body;

      for (const p of participants) {
        if (p.id === user.id) continue; // Don't email yourself
        if (!p.email || !p.notifyEmail) continue;

        await sendEmail({
          to: p.email,
          subject: `New message — ${threadRow?.subject ?? "Conversation"} — T Creative`,
          react: MessageNotification({
            recipientName: p.firstName,
            senderName,
            threadSubject: threadRow?.subject ?? "Conversation",
            messagePreview: preview,
            threadUrl: `${siteUrl}/dashboard/messages?thread=${threadId}`,
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
    const user = await getUser();

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

export async function updateThreadStatus(threadId: number, status: ThreadStatus): Promise<void> {
  try {
    z.number().int().positive().parse(threadId);
    z.enum(["new", "pending", "contacted", "approved", "rejected", "resolved"]).parse(status);
    await getUser();
    await db.update(threads).set({ status }).where(eq(threads.id, threadId));
    revalidatePath("/dashboard/messages");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function toggleThreadStar(threadId: number): Promise<void> {
  try {
    z.number().int().positive().parse(threadId);
    await getUser();
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

export async function archiveThread(threadId: number): Promise<void> {
  try {
    z.number().int().positive().parse(threadId);
    await getUser();
    await db.update(threads).set({ isArchived: true }).where(eq(threads.id, threadId));
    revalidatePath("/dashboard/messages");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function unarchiveThread(threadId: number): Promise<void> {
  try {
    z.number().int().positive().parse(threadId);
    await getUser();
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

export async function getQuickReplies(): Promise<QuickReplyRow[]> {
  try {
    await getUser();
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
    const user = await getUser();

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
    const user = await getUser();

    const isGroup = input.participantIds.length > 1;

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

    // Add all participants + the sender
    const allParticipantIds = new Set([...input.participantIds, user.id]);
    await db.insert(threadParticipants).values(
      [...allParticipantIds].map((profileId) => ({
        threadId: thread.id,
        profileId,
      })),
    );

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
 */
export async function getThreadParticipants(threadId: number): Promise<ParticipantRow[]> {
  try {
    await getUser();

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
});

export async function createBookingRequest(input: {
  serviceId: number;
  message: string;
  preferredDates?: string;
  referencePhotoUrls?: string[];
  recurrenceRule?: string;
  selectedAddOns?: { name: string; priceInCents: number }[];
}): Promise<{ threadId: number; bookingId: number }> {
  createBookingRequestSchema.parse(input);
  const user = await getUser();

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

  // Create a pending booking
  const cadenceLabel = input.recurrenceRule ? rruleToCadenceLabel(input.recurrenceRule) : null;
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
      clientNotes: [
        input.preferredDates ? `Preferred dates: ${input.preferredDates}` : null,
        cadenceLabel ? `Recurring: ${cadenceLabel}` : null,
        input.message || null,
      ]
        .filter(Boolean)
        .join("\n\n"),
    })
    .returning({ id: bookings.id });

  // Store selected add-ons as snapshots on the booking
  if (input.selectedAddOns && input.selectedAddOns.length > 0) {
    await db.insert(bookingAddOns).values(
      input.selectedAddOns.map((a) => ({
        bookingId: booking.id,
        addOnName: a.name,
        priceInCents: a.priceInCents,
      })),
    );
  }

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

  // Insert the client's initial message
  const bodyParts = [`Hi! I'd love to book a ${service.name}.`];
  if (input.selectedAddOns && input.selectedAddOns.length > 0) {
    const addOnList = input.selectedAddOns.map((a) => `${a.name} (+$${(a.priceInCents / 100).toFixed(0)})`).join(", ");
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
