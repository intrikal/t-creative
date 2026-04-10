/**
 * Zod validation schemas for booking mutations.
 *
 * Separated from the "use server" action files because Next.js does not
 * allow non-async-function exports from server-action modules.
 */
import { z } from "zod";

export const bookingInputSchema = z.object({
  clientId: z.string().min(1),
  serviceId: z.number().int().positive(),
  staffId: z.string().min(1).nullable(),
  startsAt: z.date(),
  durationMinutes: z.number().int().positive(),
  totalInCents: z.number().int().nonnegative(),
  location: z.string().optional(),
  clientNotes: z.string().optional(),
  recurrenceRule: z.string().optional(),
  subscriptionId: z.number().int().positive().optional(),
  services: z
    .array(
      z.object({
        serviceId: z.number().int().positive(),
        priceInCents: z.number().int().nonnegative(),
        durationMinutes: z.number().int().positive(),
        depositInCents: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(10)
    .optional(),
});

/** Extends the create schema with status — updateBooking can also change status. */
export const updateBookingInputSchema = bookingInputSchema.extend({
  status: z.enum(["completed", "in_progress", "confirmed", "pending", "cancelled", "no_show"]),
});
