/**
 * POST /api/book/guest-request — unauthenticated booking request from public /book page.
 *
 * Accepts guest contact info + service/date selection, then emails the studio
 * owner so they can follow up and confirm. No auth required.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { profiles, services } from "@/db/schema";
import { withRequestLogger } from "@/lib/middleware/request-logger";
import { isResendConfigured, sendEmailHtml } from "@/lib/resend";
import { verifyTurnstileToken } from "@/lib/turnstile";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  serviceId: z.union([z.string().min(1), z.number()]),
  preferredDate: z.string().min(1),
  notes: z.string().optional(),
  referencePhotoUrls: z.array(z.string().url()).optional(),
  preferredCadence: z.string().optional(),
  turnstileToken: z.string().optional(),
  selectedAddOns: z.array(z.object({ name: z.string(), priceInCents: z.number() })).optional(),
});

export const POST = withRequestLogger(async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    name,
    email,
    phone,
    serviceId,
    preferredDate,
    notes,
    referencePhotoUrls,
    preferredCadence,
    turnstileToken,
    selectedAddOns,
  } = parsed.data;

  const validToken = await verifyTurnstileToken(turnstileToken ?? "");
  if (!validToken) {
    return NextResponse.json({ error: "Bot check failed. Please try again." }, { status: 403 });
  }

  const [service] = await db
    .select({ name: services.name, priceInCents: services.priceInCents })
    .from(services)
    .where(eq(services.id, Number(serviceId)));

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  // Find the admin to notify
  const [admin] = await db
    .select({ email: profiles.email, firstName: profiles.firstName })
    .from(profiles)
    .where(eq(profiles.role, "admin"))
    .limit(1);

  if (admin && isResendConfigured()) {
    const price = service.priceInCents
      ? `$${(service.priceInCents / 100).toFixed(0)}`
      : "Contact for quote";

    await sendEmailHtml({
      to: admin.email,
      replyTo: email.trim(),
      subject: `New Booking Request: ${service.name}`,
      entityType: "guest_booking_request",
      localId: `guest-req-${Date.now()}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="margin:0 0 16px;font-size:20px;color:#1c1917">New Booking Request</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 0;color:#78716c;width:120px">Service</td><td style="padding:8px 0;font-weight:600;color:#1c1917">${service.name} (${price})</td></tr>
            <tr><td style="padding:8px 0;color:#78716c">Name</td><td style="padding:8px 0;color:#1c1917">${name.trim()}</td></tr>
            <tr><td style="padding:8px 0;color:#78716c">Email</td><td style="padding:8px 0;color:#1c1917"><a href="mailto:${email.trim()}">${email.trim()}</a></td></tr>
            ${phone?.trim() ? `<tr><td style="padding:8px 0;color:#78716c">Phone</td><td style="padding:8px 0;color:#1c1917">${phone.trim()}</td></tr>` : ""}
            <tr><td style="padding:8px 0;color:#78716c">Preferred time</td><td style="padding:8px 0;color:#1c1917">${preferredDate.trim()}</td></tr>
            ${preferredCadence?.trim() ? `<tr><td style="padding:8px 0;color:#78716c">Repeat</td><td style="padding:8px 0;color:#1c1917">${preferredCadence.trim()}</td></tr>` : ""}
            ${Array.isArray(selectedAddOns) && selectedAddOns.length > 0 ? `<tr><td style="padding:8px 0;color:#78716c">Add-ons</td><td style="padding:8px 0;color:#1c1917">${selectedAddOns.map((a) => `${a.name} (+$${(a.priceInCents / 100).toFixed(0)})`).join(", ")}</td></tr>` : ""}
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
          <p style="margin:20px 0 0;font-size:13px;color:#a8a29e">Reply directly to this email to reach ${name.trim()}.</p>
        </div>
      `,
    });
  }

  return NextResponse.json({ success: true });
});
