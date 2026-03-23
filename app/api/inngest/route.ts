/**
 * app/api/inngest/route.ts — Inngest HTTP handler.
 *
 * Registers all Inngest functions with the Inngest server.
 * Inngest calls this endpoint to discover functions and execute steps.
 */
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  bookingReminders,
  reviewRequests,
  birthdays,
  campaigns,
  zohoBooks,
  fillReminders,
  waitlistExpiry,
  backup,
  recurringBookings,
  membershipReminders,
  dailyFlash,
  birthdayPromos,
  instagramSync,
  catalogSync,
  refreshViews,
  squareWebhook,
} from "@/inngest/functions";

const handler = serve({
  client: inngest,
  functions: [
    bookingReminders,
    reviewRequests,
    birthdays,
    campaigns,
    zohoBooks,
    fillReminders,
    waitlistExpiry,
    backup,
    recurringBookings,
    membershipReminders,
    dailyFlash,
    birthdayPromos,
    instagramSync,
    catalogSync,
    refreshViews,
    squareWebhook,
  ],
});

export const { GET, POST, PUT } = handler;
