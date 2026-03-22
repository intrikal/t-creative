/**
 * GET /api/receipts/[bookingId] — Generate and download a PDF receipt.
 *
 * Auth: client must own the booking, OR requester must be admin/assistant.
 * Returns Content-Type: application/pdf with inline disposition.
 */
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, bookingAddOns, payments, profiles, services } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";
import { getPublicBusinessProfile } from "@/app/dashboard/settings/settings-actions";
import { generateReceiptPdf, type ReceiptData } from "@/lib/generate-receipt-pdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    /* ── Auth ── */
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [profile] = await db
      .select({ role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { bookingId: bookingIdStr } = await params;
    const bookingId = Number(bookingIdStr);
    if (!bookingId || Number.isNaN(bookingId)) {
      return NextResponse.json({ error: "Invalid booking ID" }, { status: 400 });
    }

    /* ── Fetch booking ── */
    const staffAlias = db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
      })
      .from(profiles)
      .as("staff");

    const [booking] = await db
      .select({
        id: bookings.id,
        clientId: bookings.clientId,
        status: bookings.status,
        startsAt: bookings.startsAt,
        durationMinutes: bookings.durationMinutes,
        totalInCents: bookings.totalInCents,
        discountInCents: bookings.discountInCents,
        depositPaidInCents: bookings.depositPaidInCents,
        location: bookings.location,
        serviceName: services.name,
        clientFirstName: profiles.firstName,
        clientLastName: profiles.lastName,
        staffId: bookings.staffId,
      })
      .from(bookings)
      .leftJoin(services, eq(bookings.serviceId, services.id))
      .leftJoin(profiles, eq(bookings.clientId, profiles.id))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    /* ── Authorization: client owns booking OR admin/assistant ── */
    const isOwner = booking.clientId === user.id;
    const isStaff = profile.role === "admin" || profile.role === "assistant";
    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    /* ── Fetch related data ── */
    const [paymentRows, addOnRows, businessProfile] = await Promise.all([
      db
        .select()
        .from(payments)
        .where(
          and(eq(payments.bookingId, bookingId), eq(payments.status, "paid")),
        ),
      db
        .select()
        .from(bookingAddOns)
        .where(eq(bookingAddOns.bookingId, bookingId)),
      getPublicBusinessProfile(),
    ]);

    /* Fetch staff name if assigned */
    let staffName: string | null = null;
    if (booking.staffId) {
      const [staff] = await db
        .select({ firstName: profiles.firstName, lastName: profiles.lastName })
        .from(profiles)
        .where(eq(profiles.id, booking.staffId))
        .limit(1);
      if (staff) {
        staffName = [staff.firstName, staff.lastName].filter(Boolean).join(" ");
      }
    }

    const startsAt = new Date(booking.startsAt);
    const clientName = [booking.clientFirstName, booking.clientLastName]
      .filter(Boolean)
      .join(" ");

    const receiptData: ReceiptData = {
      businessName: businessProfile.businessName,
      businessAddress: businessProfile.location,
      businessPhone: businessProfile.phone,
      businessEmail: businessProfile.email,

      clientName,
      serviceName: booking.serviceName ?? "Service",
      staffName,
      date: startsAt.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      time: startsAt.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      durationMinutes: booking.durationMinutes,
      location: booking.location,

      serviceAmountInCents: booking.totalInCents,
      addOns: addOnRows.map((a) => ({
        name: a.addOnName,
        priceInCents: a.priceInCents,
      })),
      discountInCents: booking.discountInCents,
      depositPaidInCents: booking.depositPaidInCents,

      payments: paymentRows.map((p) => ({
        amountInCents: p.amountInCents,
        tipInCents: p.tipInCents,
        taxAmountInCents: p.taxAmountInCents,
        method: p.method,
        squarePaymentId: p.squarePaymentId,
        paidAt: p.paidAt?.toISOString() ?? null,
      })),

      bookingId: booking.id,
      receiptDate: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };

    /* ── Generate PDF ── */
    const pdfBuffer = await generateReceiptPdf(receiptData);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="receipt-TC-${bookingId}.pdf"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Failed to generate receipt" },
      { status: 500 },
    );
  }
}
