/**
 * POST /api/book/pay-deposit — Process an inline deposit payment during booking.
 *
 * Accepts either an authenticated user or a guest (with Turnstile token).
 * Creates the booking as "pending" (admin still confirms) with the deposit
 * already collected via Square Payments API.
 *
 * For guests: also sends the admin notification email (same as guest-request).
 * For authenticated users: creates the message thread (same as createBookingRequest).
 *
 * Body:
 *   sourceId       — Square Web Payments SDK token (nonce)
 *   serviceId      — service ID
 *   preferredDate  — formatted date string
 *   notes          — optional
 *   recurrenceRule  — optional RRULE string (e.g. "FREQ=WEEKLY;INTERVAL=3")
 *   referencePhotoUrls — optional string[]
 *   idempotencyKey — client-generated UUID for Square payment dedup
 *
 * Guest-only fields (when not authenticated):
 *   name, email, phone, turnstileToken
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/db";
import { bookings, bookingAddOns, payments, profiles, services, syncLog } from "@/db/schema";
import { logAction } from "@/lib/audit";
import { rruleToCadenceLabel } from "@/lib/cadence";
import { trackEvent } from "@/lib/posthog";
import { RESEND_FROM, isResendConfigured } from "@/lib/resend";
import { isSquareConfigured, createSquarePayment } from "@/lib/square";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  if (!isSquareConfigured()) {
    return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    sourceId,
    serviceId,
    preferredDate,
    notes,
    recurrenceRule,
    referencePhotoUrls,
    idempotencyKey,
    selectedAddOns,
    tosAccepted,
    tosVersion,
    // Guest fields
    name: guestName,
    email: guestEmail,
    phone: guestPhone,
    turnstileToken,
  } = body as {
    sourceId: string;
    serviceId: number;
    preferredDate: string;
    notes?: string;
    recurrenceRule?: string;
    referencePhotoUrls?: string[];
    idempotencyKey: string;
    name?: string;
    email?: string;
    phone?: string;
    turnstileToken?: string;
    selectedAddOns?: { name: string; priceInCents: number }[];
    tosAccepted?: boolean;
    tosVersion?: string;
  };

  if (!sourceId || !serviceId || !preferredDate || !idempotencyKey) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (tosAccepted !== true) {
    return NextResponse.json({ error: "Policy acceptance is required" }, { status: 400 });
  }

  // ── Determine user identity ──
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isGuest = !user;

  if (isGuest) {
    if (!guestName?.trim() || !guestEmail?.trim()) {
      return NextResponse.json({ error: "Name and email required for guests" }, { status: 400 });
    }
    if (!guestEmail.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    const validToken = await verifyTurnstileToken(turnstileToken ?? "");
    if (!validToken) {
      return NextResponse.json({ error: "Bot check failed. Please try again." }, { status: 403 });
    }
  }

  // ── Look up service ──
  const [service] = await db
    .select({
      name: services.name,
      priceInCents: services.priceInCents,
      durationMinutes: services.durationMinutes,
      depositInCents: services.depositInCents,
    })
    .from(services)
    .where(eq(services.id, Number(serviceId)));

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  if (!service.depositInCents || service.depositInCents <= 0) {
    return NextResponse.json({ error: "This service does not require a deposit" }, { status: 400 });
  }

  // ── Create pending booking ──
  const clientId = user?.id;
  const cadenceLabel = recurrenceRule ? rruleToCadenceLabel(recurrenceRule) : null;
  const clientNotes = [
    preferredDate ? `Preferred dates: ${preferredDate}` : null,
    cadenceLabel ? `Recurring: ${cadenceLabel}` : null,
    notes?.trim() || null,
    isGuest
      ? `Guest booking: ${guestName!.trim()} (${guestEmail!.trim()}${guestPhone?.trim() ? `, ${guestPhone.trim()}` : ""})`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  // For guests, use a system-level placeholder client ID.
  // We'll use the admin profile ID as a fallback since bookings require clientId.
  let bookingClientId: string;
  if (clientId) {
    bookingClientId = clientId;
  } else {
    // Find the admin profile — guest bookings are tracked under admin until they register
    const [admin] = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.role, "admin"))
      .limit(1);
    if (!admin) {
      return NextResponse.json({ error: "System configuration error" }, { status: 500 });
    }
    bookingClientId = admin.id;
  }

  let bookingId: number;
  try {
    const [newBooking] = await db
      .insert(bookings)
      .values({
        clientId: bookingClientId,
        serviceId: Number(serviceId),
        staffId: null,
        status: "pending",
        startsAt: new Date(), // Placeholder — admin sets actual time on confirmation
        durationMinutes: service.durationMinutes ?? 60,
        totalInCents: service.priceInCents ?? 0,
        recurrenceRule: recurrenceRule || null,
        tosAcceptedAt: new Date(),
        tosVersion: tosVersion || null,
        clientNotes,
      })
      .returning({ id: bookings.id });
    bookingId = newBooking.id;

    // Store selected add-ons as snapshots on the booking
    if (Array.isArray(selectedAddOns) && selectedAddOns.length > 0) {
      await db.insert(bookingAddOns).values(
        selectedAddOns.map((a: { name: string; priceInCents: number }) => ({
          bookingId: newBooking.id,
          addOnName: a.name,
          priceInCents: a.priceInCents,
        })),
      );
    }
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }

  // ── Process deposit payment via Square ──
  try {
    const { paymentId, orderId, receiptUrl } = await createSquarePayment({
      bookingId,
      serviceName: service.name,
      amountInCents: service.depositInCents,
      sourceId,
      idempotencyKey,
      note: `Booking #${bookingId} (deposit) — ${isGuest ? guestName!.trim() : "authenticated client"}`,
    });

    // Update booking with deposit + Square order ID
    await db
      .update(bookings)
      .set({
        depositPaidInCents: service.depositInCents,
        depositPaidAt: new Date(),
        squareOrderId: orderId,
      })
      .where(eq(bookings.id, bookingId));

    // Record the payment
    await db.insert(payments).values({
      bookingId,
      clientId: bookingClientId,
      amountInCents: service.depositInCents,
      method: "square_card",
      status: "paid",
      paidAt: new Date(),
      squarePaymentId: paymentId,
      squareOrderId: orderId,
      squareReceiptUrl: receiptUrl,
      notes: "Deposit collected inline during booking",
    });

    // Sync log
    await db.insert(syncLog).values({
      provider: "square",
      direction: "outbound",
      status: "success",
      entityType: "inline_deposit_payment",
      localId: String(bookingId),
      remoteId: paymentId,
      message: `Inline deposit payment for booking #${bookingId}`,
      payload: { paymentId, orderId, amountInCents: service.depositInCents },
    });

    await logAction({
      actorId: clientId ?? null,
      action: "create",
      entityType: "payment",
      entityId: String(bookingId),
      description: `Inline deposit of ${service.depositInCents}¢ collected during booking #${bookingId}`,
      metadata: { paymentId, orderId, isGuest },
    });

    trackEvent(bookingClientId, "deposit_paid_inline", {
      bookingId,
      serviceId: Number(serviceId),
      amountInCents: service.depositInCents,
      isGuest,
    });
  } catch (err) {
    // Payment failed — delete the pending booking so it's not orphaned
    Sentry.captureException(err);
    await db.update(bookings).set({ deletedAt: new Date() }).where(eq(bookings.id, bookingId));
    const message = err instanceof Error ? err.message : "Payment processing failed";
    return NextResponse.json({ error: message }, { status: 402 });
  }

  // ── Notify admin ──
  const [admin] = await db
    .select({ email: profiles.email, firstName: profiles.firstName })
    .from(profiles)
    .where(eq(profiles.role, "admin"))
    .limit(1);

  if (admin?.email && isResendConfigured()) {
    const depositLabel = `$${(service.depositInCents / 100).toFixed(2)}`;
    const price = service.priceInCents
      ? `$${(service.priceInCents / 100).toFixed(0)}`
      : "Contact for quote";

    const contactInfo = isGuest
      ? `<tr><td style="padding:8px 0;color:#78716c">Name</td><td style="padding:8px 0;color:#1c1917">${guestName!.trim()}</td></tr>
         <tr><td style="padding:8px 0;color:#78716c">Email</td><td style="padding:8px 0;color:#1c1917"><a href="mailto:${guestEmail!.trim()}">${guestEmail!.trim()}</a></td></tr>
         ${guestPhone?.trim() ? `<tr><td style="padding:8px 0;color:#78716c">Phone</td><td style="padding:8px 0;color:#1c1917">${guestPhone.trim()}</td></tr>` : ""}`
      : "";

    try {
      const resend = new Resend(process.env.RESEND_API_KEY!);
      await resend.emails.send({
        from: RESEND_FROM,
        to: admin.email,
        subject: `New Booking Request (deposit paid): ${service.name}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="margin:0 0 16px;font-size:20px;color:#1c1917">New Booking Request</h2>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin-bottom:16px">
              <p style="margin:0;font-size:14px;font-weight:600;color:#166534">Deposit paid: ${depositLabel}</p>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:8px 0;color:#78716c;width:120px">Service</td><td style="padding:8px 0;font-weight:600;color:#1c1917">${service.name} (${price})</td></tr>
              ${contactInfo}
              <tr><td style="padding:8px 0;color:#78716c">Preferred time</td><td style="padding:8px 0;color:#1c1917">${preferredDate}</td></tr>
              ${cadenceLabel ? `<tr><td style="padding:8px 0;color:#78716c">Repeat</td><td style="padding:8px 0;color:#1c1917">${cadenceLabel}</td></tr>` : ""}
              ${Array.isArray(selectedAddOns) && selectedAddOns.length > 0 ? `<tr><td style="padding:8px 0;color:#78716c">Add-ons</td><td style="padding:8px 0;color:#1c1917">${selectedAddOns.map((a: { name: string; priceInCents: number }) => `${a.name} (+$${(a.priceInCents / 100).toFixed(0)})`).join(", ")}</td></tr>` : ""}
              ${notes?.trim() ? `<tr><td style="padding:8px 0;color:#78716c;vertical-align:top">Notes</td><td style="padding:8px 0;color:#1c1917">${notes.trim()}</td></tr>` : ""}
            </table>
            ${
              Array.isArray(referencePhotoUrls) && referencePhotoUrls.length > 0
                ? `<div style="margin-top:20px">
                    <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#1c1917">Reference photos (${referencePhotoUrls.length})</p>
                    <div style="display:flex;flex-wrap:wrap;gap:8px">
                      ${referencePhotoUrls
                        .map(
                          (url) =>
                            `<a href="${url}" target="_blank" style="display:block;border-radius:8px;overflow:hidden;border:1px solid #e7e5e4"><img src="${url}" alt="Reference photo" style="width:120px;height:120px;object-fit:cover;display:block" /></a>`,
                        )
                        .join("")}
                    </div>
                  </div>`
                : ""
            }
            <p style="margin:20px 0 0;font-size:13px;color:#a8a29e">Booking #${bookingId} — deposit already collected.</p>
          </div>
        `,
      });
    } catch (emailErr) {
      // Non-fatal — admin notification failure shouldn't fail the booking
      Sentry.captureException(emailErr);
    }
  }

  return NextResponse.json({ success: true, bookingId });
}
