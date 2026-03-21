/**
 * lib/waitlist-notify.ts — Shared waitlist notification logic.
 *
 * Extracted here so both the admin cancellation path (actions.ts) and the
 * client-side cancellation path (client-actions.ts) can trigger waitlist
 * notifications without importing from each other.
 *
 * ## Flow
 * 1. A booking is cancelled (by admin or client).
 * 2. `notifyWaitlistForCancelledBooking(bookingId)` is called — it looks up
 *    the cancelled booking's service, slot time, and staff, then delegates to
 *    `notifyNextWaitlistEntry`.
 * 3. `notifyNextWaitlistEntry` finds the FIRST "waiting" entry for that service
 *    (ordered by `createdAt` ASC — earliest joiner gets first offer), generates
 *    a unique claim token, stores the offered slot on the waitlist row, and
 *    sends a `WaitlistNotification` email containing a direct booking link.
 * 4. The token expires in 24 hours. If unused, the expiry cron
 *    (`/api/cron/waitlist-expiry`) advances the queue to the next person.
 */
import { randomUUID } from "crypto";
import { format } from "date-fns";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, notifications, profiles, services, waitlist } from "@/db/schema";
import { getPublicBookingRules, getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { WaitlistNotification } from "@/emails/WaitlistNotification";
import { sendEmail } from "@/lib/resend";

/* ------------------------------------------------------------------ */
/*  Public entry points                                                */
/* ------------------------------------------------------------------ */

/**
 * Top-level helper called after any booking cancellation.
 * Looks up the cancelled booking's slot details and forwards to
 * `notifyNextWaitlistEntry`.
 *
 * Non-fatal — exceptions are swallowed so cancellation is never blocked.
 */
export async function notifyWaitlistForCancelledBooking(cancelledBookingId: number): Promise<void> {
  try {
    // Query: SELECT serviceId, startsAt, staffId FROM bookings WHERE id = cancelledBookingId
    // Fetches the cancelled booking's slot details so we can offer the same
    // service + time + staff to the next person on the waitlist.
    const [cancelled] = await db
      .select({
        serviceId: bookings.serviceId,
        startsAt: bookings.startsAt,
        staffId: bookings.staffId,
      })
      .from(bookings)
      .where(eq(bookings.id, cancelledBookingId));

    if (!cancelled) return;

    await notifyNextWaitlistEntry({
      serviceId: cancelled.serviceId,
      offeredSlotStartsAt: cancelled.startsAt,
      offeredStaffId: cancelled.staffId,
    });
  } catch {
    // Non-fatal — waitlist notification failure must never block cancellation
  }
}

/**
 * Finds the next "waiting" entry for a service (FIFO order), generates a
 * claim token, updates the row, and sends the notification email.
 *
 * Exported so the expiry cron can re-offer a slot to the next person in
 * queue after the previous offer times out.
 */
export async function notifyNextWaitlistEntry({
  serviceId,
  offeredSlotStartsAt,
  offeredStaffId,
}: {
  serviceId: number;
  offeredSlotStartsAt: Date;
  offeredStaffId: string | null;
}): Promise<void> {
  // Query: SELECT waitlist.id, clientId, profiles.email, profiles.firstName,
  //        profiles.notifyEmail, services.name
  //   FROM waitlist
  //   INNER JOIN profiles ON waitlist.clientId = profiles.id
  //   INNER JOIN services ON waitlist.serviceId = services.id
  //   WHERE waitlist.serviceId = ? AND waitlist.status = 'waiting'
  //   ORDER BY waitlist.createdAt ASC  -- FIFO: earliest joiner first
  //   LIMIT 1
  //
  // INNER JOINs are used (not LEFT) because a waitlist entry without a
  // valid profile or service is orphaned and should be skipped.
  const [entry] = await db
    .select({
      id: waitlist.id,
      clientId: waitlist.clientId,
      clientEmail: profiles.email,
      clientFirstName: profiles.firstName,
      notifyEmail: profiles.notifyEmail,
      serviceName: services.name,
    })
    .from(waitlist)
    .innerJoin(profiles, eq(waitlist.clientId, profiles.id))
    .innerJoin(services, eq(waitlist.serviceId, services.id))
    .where(and(eq(waitlist.serviceId, serviceId), eq(waitlist.status, "waiting")))
    // FIFO — earliest joiner gets first offer. If they don't claim within
    // the window, the expiry cron calls this function again for the next entry.
    .orderBy(asc(waitlist.createdAt))
    .limit(1);

  if (!entry || !entry.clientEmail || !entry.notifyEmail) return;

  const [bookingRules, bp] = await Promise.all([
    getPublicBookingRules(),
    getPublicBusinessProfile(),
  ]);
  const claimWindowMs = bookingRules.waitlistClaimWindowHours * 60 * 60 * 1000;

  // UUID claim token is single-use — validated by the /book/claim/[token] route.
  // Expiry is configurable via admin settings (default 24h).
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + claimWindowMs);

  // UPDATE waitlist SET status='notified', notifiedAt=now(), claimToken=<uuid>,
  //   claimTokenExpiresAt=<now + claimWindow>, offeredSlotStartsAt=<slot>,
  //   offeredStaffId=<staffId>
  // WHERE id = entry.id
  //
  // Transitions the waitlist entry from "waiting" to "notified" and stores
  // the claim token + expiry. The /book/claim/[token] route validates the
  // token and converts the waitlist entry into a confirmed booking.
  await db
    .update(waitlist)
    .set({
      status: "notified",
      notifiedAt: new Date(),
      claimToken: token,
      claimTokenExpiresAt: expiresAt,
      offeredSlotStartsAt,
      offeredStaffId: offeredStaffId ?? null,
    })
    .where(eq(waitlist.id, entry.id));

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tcreativestudio.com";
  const bookingLink = `${siteUrl}/book/claim/${token}`;
  const slotDate = format(offeredSlotStartsAt, "EEEE, MMMM d 'at' h:mm a");

  await sendEmail({
    to: entry.clientEmail,
    subject: `A spot opened up — ${entry.serviceName} — ${bp.businessName}`,
    react: WaitlistNotification({
      clientName: entry.clientFirstName ?? "there",
      serviceName: entry.serviceName,
      bookingLink,
      slotDate,
    }),
    entityType: "waitlist_notification",
    localId: String(entry.id),
  });

  // Also create an in-app notification so the client sees it in their
  // dashboard even if the email is missed. Non-fatal — email is primary.
  try {
    await db.insert(notifications).values({
      profileId: entry.clientId,
      type: "waitlist_alert",
      channel: "internal",
      status: "delivered",
      title: `A ${entry.serviceName} spot opened up`,
      body: `Slot available: ${slotDate}. Claim it before it expires.`,
      relatedEntityType: "waitlist",
      relatedEntityId: entry.id,
    });
  } catch {
    // Non-fatal
  }
}
