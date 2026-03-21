/**
 * app/dashboard/bookings/waitlist-actions.ts — Waitlist management actions.
 *
 * CRUD operations for the booking waitlist: view, add, update status,
 * and remove entries. Sends notification emails when clients are notified.
 */
"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { db } from "@/db";
import { profiles, services, waitlist } from "@/db/schema";
import { WaitlistNotification } from "@/emails/WaitlistNotification";
import { getUser } from "@/lib/auth";
import { trackEvent } from "@/lib/posthog";
import { sendEmail } from "@/lib/resend";

export type WaitlistRow = {
  id: number;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  serviceId: number;
  serviceName: string;
  serviceCategory: string;
  status: "waiting" | "notified" | "booked" | "expired" | "cancelled";
  preferredDateStart: string | null;
  preferredDateEnd: string | null;
  timePreference: string | null;
  notes: string | null;
  notifiedAt: string | null;
  createdAt: string;
};

export type WaitlistInput = {
  clientId: string;
  serviceId: number;
  preferredDateStart?: string;
  preferredDateEnd?: string;
  timePreference?: string;
  notes?: string;
};

export async function getWaitlist(): Promise<WaitlistRow[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        id: waitlist.id,
        clientId: waitlist.clientId,
        clientFirstName: profiles.firstName,
        clientLastName: profiles.lastName,
        clientPhone: profiles.phone,
        serviceId: waitlist.serviceId,
        serviceName: services.name,
        serviceCategory: services.category,
        status: waitlist.status,
        preferredDateStart: waitlist.preferredDateStart,
        preferredDateEnd: waitlist.preferredDateEnd,
        timePreference: waitlist.timePreference,
        notes: waitlist.notes,
        notifiedAt: waitlist.notifiedAt,
        createdAt: waitlist.createdAt,
      })
      .from(waitlist)
      .innerJoin(profiles, eq(waitlist.clientId, profiles.id))
      .innerJoin(services, eq(waitlist.serviceId, services.id))
      .orderBy(desc(waitlist.createdAt));

    return rows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      clientName: [r.clientFirstName, r.clientLastName].filter(Boolean).join(" "),
      clientPhone: r.clientPhone,
      serviceId: r.serviceId,
      serviceName: r.serviceName,
      serviceCategory: r.serviceCategory,
      status: r.status,
      preferredDateStart: r.preferredDateStart,
      preferredDateEnd: r.preferredDateEnd,
      timePreference: r.timePreference,
      notes: r.notes,
      notifiedAt: r.notifiedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

const waitlistInputSchema = z.object({
  clientId: z.string().min(1),
  serviceId: z.number().int().positive(),
  preferredDateStart: z.string().optional(),
  preferredDateEnd: z.string().optional(),
  timePreference: z.string().optional(),
  notes: z.string().optional(),
});

export async function addToWaitlist(input: WaitlistInput): Promise<void> {
  try {
    waitlistInputSchema.parse(input);
    const user = await getUser();

    await db.insert(waitlist).values({
      clientId: input.clientId,
      serviceId: input.serviceId,
      preferredDateStart: input.preferredDateStart ?? null,
      preferredDateEnd: input.preferredDateEnd ?? null,
      timePreference: input.timePreference ?? null,
      notes: input.notes ?? null,
    });

    trackEvent(user.id, "waitlist_added", {
      clientId: input.clientId,
      serviceId: input.serviceId,
    });

    revalidatePath("/dashboard/bookings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function updateWaitlistStatus(
  id: number,
  status: "waiting" | "notified" | "booked" | "expired" | "cancelled",
): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    z.enum(["waiting", "notified", "booked", "expired", "cancelled"]).parse(status);
    await getUser();

    const updates: Record<string, unknown> = { status };
    if (status === "notified") {
      updates.notifiedAt = new Date();
    }

    await db.update(waitlist).set(updates).where(eq(waitlist.id, id));

    // Send notification email when marking as notified
    if (status === "notified") {
      try {
        const waitlistClient = alias(profiles, "waitlistClient");
        const [row] = await db
          .select({
            clientEmail: waitlistClient.email,
            clientFirstName: waitlistClient.firstName,
            notifyEmail: waitlistClient.notifyEmail,
            serviceName: services.name,
          })
          .from(waitlist)
          .innerJoin(waitlistClient, eq(waitlist.clientId, waitlistClient.id))
          .innerJoin(services, eq(waitlist.serviceId, services.id))
          .where(eq(waitlist.id, id));

        if (row?.clientEmail && row.notifyEmail) {
          const bp = await getPublicBusinessProfile();
          await sendEmail({
            to: row.clientEmail,
            subject: `A spot opened up — ${row.serviceName} — ${bp.businessName}`,
            react: WaitlistNotification({
              clientName: row.clientFirstName,
              serviceName: row.serviceName,
              businessName: bp.businessName,
            }),
            entityType: "waitlist_notification",
            localId: String(id),
          });
        }
      } catch {
        // Non-fatal
      }
    }

    revalidatePath("/dashboard/bookings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

export async function removeFromWaitlistById(id: number): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    await getUser();
    await db.delete(waitlist).where(eq(waitlist.id, id));
    revalidatePath("/dashboard/bookings");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
