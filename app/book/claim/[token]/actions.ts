"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, profiles, services, waitlist } from "@/db/schema";
import { logAction } from "@/lib/audit";
import { trackEvent } from "@/lib/posthog";

export type ClaimResult =
  | { success: true; bookingId: number }
  | { success: false; error: "invalid_token" | "expired" | "already_claimed" | "unknown" };

/**
 * Validates a waitlist claim token and creates the booking.
 *
 * The token is proof of identity — it was emailed directly to the client —
 * so no session auth is required.  The booking is created in "pending" status;
 * admin confirmation (and the resulting deposit-link email) follows the normal
 * booking confirmation flow.
 */
export async function claimWaitlistSlot(token: string): Promise<ClaimResult> {
  try {
    // 1. Find the waitlist entry by token
    const [entry] = await db
      .select({
        id: waitlist.id,
        clientId: waitlist.clientId,
        serviceId: waitlist.serviceId,
        status: waitlist.status,
        claimTokenExpiresAt: waitlist.claimTokenExpiresAt,
        offeredSlotStartsAt: waitlist.offeredSlotStartsAt,
        offeredStaffId: waitlist.offeredStaffId,
      })
      .from(waitlist)
      .where(eq(waitlist.claimToken, token))
      .limit(1);

    if (!entry) return { success: false, error: "invalid_token" };
    if (entry.status === "booked") return { success: false, error: "already_claimed" };
    if (entry.status !== "notified") return { success: false, error: "invalid_token" };

    const now = new Date();
    if (!entry.claimTokenExpiresAt || entry.claimTokenExpiresAt < now) {
      return { success: false, error: "expired" };
    }
    if (!entry.offeredSlotStartsAt) return { success: false, error: "invalid_token" };

    // 2. Look up service price + duration to snapshot into the booking
    const [svc] = await db
      .select({ priceInCents: services.priceInCents, durationMinutes: services.durationMinutes })
      .from(services)
      .where(eq(services.id, entry.serviceId))
      .limit(1);

    const durationMinutes = svc?.durationMinutes ?? 60;
    const totalInCents = svc?.priceInCents ?? 0;

    // 3. Create booking as pending — admin confirmation triggers deposit link etc.
    const [newBooking] = await db
      .insert(bookings)
      .values({
        clientId: entry.clientId,
        serviceId: entry.serviceId,
        staffId: entry.offeredStaffId ?? undefined,
        startsAt: entry.offeredSlotStartsAt,
        durationMinutes,
        totalInCents,
        status: "pending",
        clientNotes: "Booked via waitlist claim link",
      })
      .returning({ id: bookings.id });

    // 4. Mark waitlist entry as booked, clear the token
    await db
      .update(waitlist)
      .set({
        status: "booked",
        bookedBookingId: newBooking.id,
        claimToken: null,
        claimTokenExpiresAt: null,
      })
      .where(eq(waitlist.id, entry.id));

    // 5. Audit + analytics
    trackEvent(entry.clientId, "waitlist_slot_claimed", {
      waitlistId: entry.id,
      bookingId: newBooking.id,
      serviceId: entry.serviceId,
    });

    await logAction({
      actorId: entry.clientId,
      action: "create",
      entityType: "booking",
      entityId: String(newBooking.id),
      description: "Booking created from waitlist claim",
      metadata: { waitlistId: entry.id, token },
    });

    return { success: true, bookingId: newBooking.id };
  } catch (err) {
    console.error("[claimWaitlistSlot]", err);
    return { success: false, error: "unknown" };
  }
}

/* ------------------------------------------------------------------ */
/*  Read-only helper for the page server component                    */
/* ------------------------------------------------------------------ */

export type ClaimPageData =
  | {
      valid: true;
      serviceName: string;
      slotDate: string; // ISO string — formatted in the component
      staffName: string | null;
      expiresAt: string; // ISO string
    }
  | { valid: false; reason: "invalid_token" | "expired" | "already_claimed" };

export async function getClaimPageData(token: string): Promise<ClaimPageData> {
  const [entry] = await db
    .select({
      status: waitlist.status,
      claimTokenExpiresAt: waitlist.claimTokenExpiresAt,
      offeredSlotStartsAt: waitlist.offeredSlotStartsAt,
      offeredStaffId: waitlist.offeredStaffId,
      serviceName: services.name,
    })
    .from(waitlist)
    .innerJoin(services, eq(waitlist.serviceId, services.id))
    .where(eq(waitlist.claimToken, token))
    .limit(1);

  if (!entry) return { valid: false, reason: "invalid_token" };
  if (entry.status === "booked") return { valid: false, reason: "already_claimed" };
  if (entry.status !== "notified") return { valid: false, reason: "invalid_token" };

  const now = new Date();
  if (!entry.claimTokenExpiresAt || entry.claimTokenExpiresAt < now) {
    return { valid: false, reason: "expired" };
  }
  if (!entry.offeredSlotStartsAt) return { valid: false, reason: "invalid_token" };

  // Look up staff name if assigned
  let staffName: string | null = null;
  if (entry.offeredStaffId) {
    const [staff] = await db
      .select({ firstName: profiles.firstName })
      .from(profiles)
      .where(eq(profiles.id, entry.offeredStaffId))
      .limit(1);
    staffName = staff?.firstName ?? null;
  }

  return {
    valid: true,
    serviceName: entry.serviceName,
    slotDate: entry.offeredSlotStartsAt.toISOString(),
    staffName,
    expiresAt: entry.claimTokenExpiresAt.toISOString(),
  };
}
