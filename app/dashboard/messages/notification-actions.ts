"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notifications, profiles } from "@/db/schema";
import { trackEvent } from "@/lib/posthog";
import { sendEmail, getEmailRecipient } from "@/lib/resend";
import { createClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
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
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type NotificationType =
  | "booking_reminder"
  | "booking_confirmation"
  | "booking_cancellation"
  | "review_request"
  | "waitlist_alert"
  | "promotion"
  | "form_request"
  | "general";

export type NotificationStatus = "pending" | "sent" | "delivered" | "failed" | "clicked";

export type NotificationChannel = "internal" | "email" | "sms";

export type NotificationRow = {
  id: number;
  profileId: string;
  recipientName: string;
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  title: string;
  body: string | null;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  errorMessage: string | null;
  scheduledFor: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type NotificationInput = {
  profileId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body?: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
  scheduledFor?: string;
};

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

export async function getNotifications(profileId?: string): Promise<NotificationRow[]> {
  try {
    await getUser();

    const query = db
      .select({
        id: notifications.id,
        profileId: notifications.profileId,
        recipientFirstName: profiles.firstName,
        recipientLastName: profiles.lastName,
        type: notifications.type,
        channel: notifications.channel,
        status: notifications.status,
        title: notifications.title,
        body: notifications.body,
        relatedEntityType: notifications.relatedEntityType,
        relatedEntityId: notifications.relatedEntityId,
        errorMessage: notifications.errorMessage,
        scheduledFor: notifications.scheduledFor,
        sentAt: notifications.sentAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .innerJoin(profiles, eq(notifications.profileId, profiles.id))
      .orderBy(desc(notifications.createdAt))
      .limit(100);

    const rows = profileId
      ? await query.where(eq(notifications.profileId, profileId))
      : await query;

    return rows.map((r) => ({
      id: r.id,
      profileId: r.profileId,
      recipientName: [r.recipientFirstName, r.recipientLastName].filter(Boolean).join(" "),
      type: r.type,
      channel: r.channel,
      status: r.status,
      title: r.title,
      body: r.body,
      relatedEntityType: r.relatedEntityType,
      relatedEntityId: r.relatedEntityId,
      errorMessage: r.errorMessage,
      scheduledFor: r.scheduledFor?.toISOString() ?? null,
      sentAt: r.sentAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

const notificationInputSchema = z.object({
  profileId: z.string().min(1),
  type: z.enum([
    "booking_reminder",
    "booking_confirmation",
    "booking_cancellation",
    "review_request",
    "waitlist_alert",
    "promotion",
    "form_request",
    "general",
  ]),
  channel: z.enum(["internal", "email", "sms"]),
  title: z.string().min(1),
  body: z.string().optional(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.number().int().positive().optional(),
  scheduledFor: z.string().optional(),
});

export async function sendNotification(input: NotificationInput): Promise<void> {
  try {
    notificationInputSchema.parse(input);
    const user = await getUser();

    const [row] = await db
      .insert(notifications)
      .values({
        profileId: input.profileId,
        type: input.type,
        channel: input.channel,
        status: input.channel === "internal" ? "delivered" : "pending",
        title: input.title,
        body: input.body ?? null,
        relatedEntityType: input.relatedEntityType ?? null,
        relatedEntityId: input.relatedEntityId ?? null,
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
      })
      .returning();

    // For email channel, attempt to send immediately
    if (input.channel === "email") {
      const recipient = await getEmailRecipient(input.profileId);
      if (recipient) {
        // Use a simple text-based email for general notifications
        const { Text } = await import("@react-email/components");
        const { createElement } = await import("react");
        const emailBody = createElement(Text, null, input.body ?? input.title);

        const sent = await sendEmail({
          to: recipient.email,
          subject: input.title,
          react: emailBody,
          entityType: input.type,
          localId: String(row.id),
        });

        await db
          .update(notifications)
          .set({
            status: sent ? "sent" : "failed",
            sentAt: sent ? new Date() : null,
            errorMessage: sent ? null : "Email delivery failed",
          })
          .where(eq(notifications.id, row.id));
      } else {
        await db
          .update(notifications)
          .set({
            status: "failed",
            errorMessage: "No email recipient found or email notifications disabled",
          })
          .where(eq(notifications.id, row.id));
      }
    }

    trackEvent(user.id, "notification_sent", {
      type: input.type,
      channel: input.channel,
      recipientId: input.profileId,
    });

    revalidatePath("/dashboard/messages");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Record a notification for audit purposes (used by existing email flows).
 * Creates a notification record with status already set to "sent".
 */
const recordNotificationSchema = z.object({
  profileId: z.string().min(1),
  type: z.enum([
    "booking_reminder",
    "booking_confirmation",
    "booking_cancellation",
    "review_request",
    "waitlist_alert",
    "promotion",
    "form_request",
    "general",
  ]),
  channel: z.enum(["internal", "email", "sms"]),
  title: z.string().min(1),
  body: z.string().optional(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.number().int().positive().optional(),
  externalId: z.string().optional(),
});

export async function recordNotification(params: {
  profileId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body?: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
  externalId?: string;
}): Promise<void> {
  try {
    recordNotificationSchema.parse(params);
    await db.insert(notifications).values({
      profileId: params.profileId,
      type: params.type,
      channel: params.channel,
      status: "sent",
      title: params.title,
      body: params.body ?? null,
      relatedEntityType: params.relatedEntityType ?? null,
      relatedEntityId: params.relatedEntityId ?? null,
      externalId: params.externalId ?? null,
      sentAt: new Date(),
    });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
