/**
 * POST /api/book/waitlist — join the waitlist from the public /book page.
 *
 * For authenticated clients: inserts a row into the `waitlist` table.
 * For guests: emails the admin so they can follow up manually.
 * No auth required — guests can join without an account.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { profiles, services, waitlist } from "@/db/schema";
import { isResendConfigured, sendEmailHtml } from "@/lib/resend";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { createClient } from "@/utils/supabase/server";

const schema = z.object({
  serviceId: z.union([z.string().min(1), z.number()]),
  name: z.string().optional(),
  email: z.string().email().optional(),
  datePreference: z.string().optional(),
  notes: z.string().optional(),
  turnstileToken: z.string().optional(),
});

export async function POST(request: Request) {
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

  const { name, email, serviceId, datePreference, notes, turnstileToken } = parsed.data;

  const [service] = await db
    .select({ id: services.id, name: services.name })
    .from(services)
    .where(eq(services.id, Number(serviceId)));

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  // Check if the requester is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Authenticated: insert a real waitlist row
    await db.insert(waitlist).values({
      clientId: user.id,
      serviceId: service.id,
      timePreference: datePreference?.trim() || null,
      notes: notes?.trim() || null,
    });
  } else {
    // Guest: validate name + email, then email the admin
    if (!name?.trim() || !email?.trim() || !email.includes("@")) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const validToken = await verifyTurnstileToken(turnstileToken ?? "");
    if (!validToken) {
      return NextResponse.json({ error: "Bot check failed. Please try again." }, { status: 403 });
    }

    const [admin] = await db
      .select({ email: profiles.email })
      .from(profiles)
      .where(eq(profiles.role, "admin"))
      .limit(1);

    if (admin && isResendConfigured()) {
      await sendEmailHtml({
        to: admin.email,
        replyTo: email.trim(),
        subject: `Waitlist Request: ${service.name}`,
        entityType: "waitlist_request",
        localId: `waitlist-${service.id}-${Date.now()}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="margin:0 0 16px;font-size:20px;color:#1c1917">Waitlist Request</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:8px 0;color:#78716c;width:140px">Service</td><td style="padding:8px 0;font-weight:600;color:#1c1917">${service.name}</td></tr>
              <tr><td style="padding:8px 0;color:#78716c">Name</td><td style="padding:8px 0;color:#1c1917">${name.trim()}</td></tr>
              <tr><td style="padding:8px 0;color:#78716c">Email</td><td style="padding:8px 0;color:#1c1917"><a href="mailto:${email.trim()}">${email.trim()}</a></td></tr>
              ${datePreference?.trim() ? `<tr><td style="padding:8px 0;color:#78716c">Date preference</td><td style="padding:8px 0;color:#1c1917">${datePreference.trim()}</td></tr>` : ""}
              ${notes?.trim() ? `<tr><td style="padding:8px 0;color:#78716c;vertical-align:top">Notes</td><td style="padding:8px 0;color:#1c1917">${notes.trim()}</td></tr>` : ""}
            </table>
            <p style="margin:20px 0 0;font-size:13px;color:#a8a29e">Reply directly to this email to reach ${name.trim()}.</p>
          </div>
        `,
      });
    }
  }

  return NextResponse.json({ success: true });
}
