/**
 * Server actions for time-off request management (admin-facing).
 *
 * - `getPendingTimeOffRequests` — Fetch all staff time-off requests awaiting review.
 * - `approveTimeOffRequest`    — Approve a pending request (status → "approved").
 * - `denyTimeOffRequest`       — Deny a pending request, send SMS + email to staff.
 *
 * Approved time-off entries block booking creation via `hasApprovedTimeOffConflict`
 * in app/dashboard/bookings/actions.ts.
 *
 * @module dashboard/time-off-actions
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq, desc, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { timeOff, profiles } from "@/db/schema";
import { TimeOffDenied } from "@/emails/TimeOffDenied";
import { requireAdmin } from "@/lib/auth";
import { trackEvent } from "@/lib/posthog";
import { getEmailRecipient, sendEmail } from "@/lib/resend";
import { getSmsRecipient, sendSms } from "@/lib/twilio";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type PendingTimeOffRequest = {
  id: number;
  staffId: string;
  staffFirstName: string;
  staffLastName: string | null;
  startDate: string;
  endDate: string;
  type: "day_off" | "vacation";
  reason: string;
  isPartial: boolean;
  partialStartTime?: string;
  partialEndTime?: string;
  submittedOn: string;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type TimeOffMeta = {
  status?: string;
  reason?: string;
  deniedReason?: string;
  partial?: { startTime: string; endTime: string } | false;
};

function parseMeta(notes: string | null): TimeOffMeta {
  if (!notes) return {};
  try {
    return JSON.parse(notes) as TimeOffMeta;
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

/**
 * Fetch all pending staff time-off requests for the admin approval queue.
 * Filters out studio-wide closures (staffId = null) and non-pending entries.
 */
export async function getPendingTimeOffRequests(): Promise<PendingTimeOffRequest[]> {
  await requireAdmin();

  const rows = await db
    .select({
      id: timeOff.id,
      staffId: timeOff.staffId,
      staffFirstName: profiles.firstName,
      staffLastName: profiles.lastName,
      startDate: timeOff.startDate,
      endDate: timeOff.endDate,
      type: timeOff.type,
      label: timeOff.label,
      notes: timeOff.notes,
      createdAt: timeOff.createdAt,
    })
    .from(timeOff)
    .innerJoin(profiles, eq(timeOff.staffId, profiles.id))
    .where(isNotNull(timeOff.staffId))
    .orderBy(desc(timeOff.createdAt));

  return rows
    .filter((r) => {
      const meta = parseMeta(r.notes);
      return (meta.status ?? "pending") === "pending";
    })
    .map((r) => {
      const meta = parseMeta(r.notes);
      const reason = meta.reason ?? r.label ?? "";
      const partial = meta.partial ?? false;

      return {
        id: r.id,
        staffId: r.staffId!,
        staffFirstName: r.staffFirstName,
        staffLastName: r.staffLastName,
        startDate: r.startDate,
        endDate: r.endDate,
        type: r.type,
        reason,
        isPartial: !!partial,
        partialStartTime: partial ? (partial as { startTime: string }).startTime : undefined,
        partialEndTime: partial ? (partial as { endTime: string }).endTime : undefined,
        submittedOn: new Date(r.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      };
    });
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

/**
 * Approve a staff time-off request.
 * Sets notes.status = "approved". Approved entries block booking creation.
 */
export async function approveTimeOffRequest(id: number): Promise<void> {
  z.number().int().positive().parse(id);
  await requireAdmin();

  const [row] = await db.select({ notes: timeOff.notes }).from(timeOff).where(eq(timeOff.id, id));

  if (!row) throw new Error("Time-off request not found");

  const meta = parseMeta(row.notes);
  await db
    .update(timeOff)
    .set({ notes: JSON.stringify({ ...meta, status: "approved" }) })
    .where(eq(timeOff.id, id));

  trackEvent(String(id), "time_off_approved");
  revalidatePath("/dashboard");
}

/**
 * Deny a staff time-off request.
 * Sets notes.status = "denied", then sends SMS + email to the staff member.
 */
export async function denyTimeOffRequest(id: number, deniedReason?: string): Promise<void> {
  z.number().int().positive().parse(id);
  await requireAdmin();

  const [row] = await db
    .select({
      notes: timeOff.notes,
      staffId: timeOff.staffId,
      startDate: timeOff.startDate,
      endDate: timeOff.endDate,
      label: timeOff.label,
    })
    .from(timeOff)
    .where(eq(timeOff.id, id));

  if (!row) throw new Error("Time-off request not found");

  const meta = parseMeta(row.notes);
  await db
    .update(timeOff)
    .set({ notes: JSON.stringify({ ...meta, status: "denied", deniedReason: deniedReason ?? "" }) })
    .where(eq(timeOff.id, id));

  // Notify the staff member via SMS + email (non-fatal)
  if (row.staffId) {
    const startFmt = formatDateLabel(row.startDate);
    const endFmt = formatDateLabel(row.endDate);
    const dateLabel = row.startDate === row.endDate ? startFmt : `${startFmt} – ${endFmt}`;

    try {
      const smsRecipient = await getSmsRecipient(row.staffId);
      if (smsRecipient) {
        const body = deniedReason
          ? `Hi ${smsRecipient.firstName}, your time-off request for ${dateLabel} has been denied: ${deniedReason}`
          : `Hi ${smsRecipient.firstName}, your time-off request for ${dateLabel} has been denied. Please contact the studio for details.`;
        await sendSms({
          to: smsRecipient.phone,
          body,
          entityType: "time_off_denied_sms",
          localId: String(id),
        });
      }
    } catch {
      // SMS failure is non-fatal
    }

    try {
      const emailRecipient = await getEmailRecipient(row.staffId);
      if (emailRecipient) {
        await sendEmail({
          to: emailRecipient.email,
          subject: "Your time-off request has been denied",
          react: TimeOffDenied({
            staffName: emailRecipient.firstName,
            startDate: startFmt,
            endDate: endFmt,
            deniedReason: deniedReason || undefined,
          }),
          entityType: "time_off_denied_email",
          localId: String(id),
        });
      }
    } catch {
      // Email failure is non-fatal
    }
  }

  trackEvent(String(id), "time_off_denied");
  revalidatePath("/dashboard");
}
