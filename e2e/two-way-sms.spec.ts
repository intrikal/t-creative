import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { hasAuthConfig } from "./fixtures/auth";

/**
 * E2E tests for the Twilio two-way SMS webhook.
 *
 * ## Approach
 * These tests POST directly to /api/webhooks/twilio using Playwright's
 * `request` fixture — no browser, no real Twilio needed. The route skips
 * signature verification when TWILIO_AUTH_TOKEN is not set (local dev),
 * so test payloads are accepted without a valid HMAC.
 *
 * Tests that assert DB state (booking status after confirm/cancel) use the
 * Supabase service-role SDK to seed data before the request and read it
 * back after. These are skipped when SUPABASE_SERVICE_ROLE_KEY is absent.
 *
 * ## Coverage
 * (1) CONFIRM: Body 'C' → booking status = 'confirmed', reply contains 'confirmed'
 * (2) CANCEL:  Body 'CANCEL' → booking status = 'cancelled', reply contains 'cancelled'
 * (3) Case-insensitive: Body 'confirm' (lowercase) → treated as CONFIRM
 * (4) Unknown message: Body 'hello' → instructions reply
 * (5) Unknown phone number → 'could not find' reply
 * (6) No upcoming booking → 'No upcoming bookings' reply
 * (7) Multiple upcoming bookings → confirms the soonest (next starts_at)
 *
 * ## Twilio body format
 * Twilio POSTs application/x-www-form-urlencoded with at minimum:
 *   From=<e164_phone>&Body=<message_text>&MessageSid=<sid>
 */

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const WEBHOOK_URL = "/api/webhooks/twilio";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Phone numbers used only in these tests. */
const PHONE_CLIENT_A = "+12025550101";
const PHONE_CLIENT_B = "+12025550102";
const PHONE_UNKNOWN = "+19999999999";

/** Emails for test profiles (never used by real accounts). */
const EMAIL_SMS_A = "e2e-sms-a@test.tcreativestudio.com";
const EMAIL_SMS_B = "e2e-sms-b@test.tcreativestudio.com";

/* ------------------------------------------------------------------ */
/*  Supabase admin helper                                              */
/* ------------------------------------------------------------------ */

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Creates (or re-uses) a test profile with a specific phone number.
 * Returns the profile's UUID.
 */
async function seedProfile(email: string, phone: string): Promise<string> {
  const admin = adminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  let userId: string;
  if (createError) {
    // Already exists — look up via profiles
    const { data: rows } = await admin.from("profiles").select("id").eq("email", email).limit(1);
    userId = (rows?.[0] as { id: string } | undefined)?.id ?? "";
    if (!userId) throw new Error(`seedProfile: cannot find user for ${email}`);
  } else {
    userId = created.user.id;
  }

  const { error: upsertError } = await admin.from("profiles").upsert(
    {
      id: userId,
      email,
      phone,
      role: "client",
      first_name: "SMS",
      last_name: "Tester",
      is_active: true,
    },
    { onConflict: "id" },
  );
  if (upsertError) throw new Error(`seedProfile upsert: ${upsertError.message}`);

  return userId;
}

/**
 * Seeds a booking for the given client. `startsAt` defaults to 48 h from now.
 * Returns the booking ID.
 */
async function seedBooking(
  clientId: string,
  opts: {
    status?: "pending" | "confirmed";
    startsAt?: Date;
    serviceId?: number;
  } = {},
): Promise<number> {
  const admin = adminClient();

  // Resolve or create a service to satisfy the FK
  let serviceId = opts.serviceId;
  if (!serviceId) {
    const { data: existing } = await admin
      .from("services")
      .select("id")
      .eq("name", "SMS Test Service")
      .limit(1)
      .single();

    if (existing) {
      serviceId = existing.id;
    } else {
      const { data: svc, error } = await admin
        .from("services")
        .insert({
          name: "SMS Test Service",
          duration_minutes: 60,
          price_in_cents: 5000,
          is_active: true,
        })
        .select("id")
        .single();
      if (error) throw new Error(`seedBooking service insert: ${error.message}`);
      serviceId = svc!.id;
    }
  }

  const startsAt = opts.startsAt ?? new Date(Date.now() + 48 * 60 * 60 * 1000);

  const { data, error } = await admin
    .from("bookings")
    .insert({
      client_id: clientId,
      service_id: serviceId,
      status: opts.status ?? "pending",
      starts_at: startsAt.toISOString(),
      duration_minutes: 60,
      total_in_cents: 5000,
    })
    .select("id")
    .single();

  if (error) throw new Error(`seedBooking: ${error.message}`);
  return data!.id;
}

/** Reads current booking status from DB. */
async function getBookingStatus(bookingId: number): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("bookings")
    .select("status")
    .eq("id", bookingId)
    .single();
  if (error) throw new Error(`getBookingStatus: ${error.message}`);
  return data!.status;
}

/** Soft-deletes a booking so it doesn't pollute later tests. */
async function cleanupBooking(bookingId: number): Promise<void> {
  const admin = adminClient();
  await admin
    .from("bookings")
    .update({ deleted_at: new Date().toISOString(), status: "cancelled" })
    .eq("id", bookingId);
}

/** Builds a URL-encoded Twilio SMS body. */
function twilioBody(from: string, body: string, sid?: string): string {
  return new URLSearchParams({
    From: from,
    Body: body,
    MessageSid: sid ?? `SM${Date.now()}test`,
    AccountSid: "AC_test",
    To: "+10005550000",
    NumMedia: "0",
  }).toString();
}

/* ================================================================== */
/*  (1) CONFIRM: Body 'C' → booking confirmed, reply says confirmed   */
/* ================================================================== */

test.describe("(1) CONFIRM via 'C'", () => {
  let clientId: string;
  let bookingId: number;

  test.beforeAll(async () => {
    if (!hasAuthConfig()) return;
    clientId = await seedProfile(EMAIL_SMS_A, PHONE_CLIENT_A);
    bookingId = await seedBooking(clientId, { status: "pending" });
  });

  test.afterAll(async () => {
    if (!hasAuthConfig()) return;
    await cleanupBooking(bookingId);
  });

  test("returns 200 with TwiML, booking becomes confirmed", async ({ request }) => {
    if (!hasAuthConfig()) test.skip();

    const response = await request.post(WEBHOOK_URL, {
      data: twilioBody(PHONE_CLIENT_A, "C"),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    expect(response.status()).toBe(200);

    const xml = await response.text();
    expect(xml).toContain("<Message>");
    expect(xml.toLowerCase()).toContain("confirmed");

    const status = await getBookingStatus(bookingId);
    expect(status).toBe("confirmed");
  });
});

/* ================================================================== */
/*  (2) CANCEL: Body 'CANCEL' → booking cancelled, reply says so     */
/* ================================================================== */

test.describe("(2) CANCEL via 'CANCEL'", () => {
  let clientId: string;
  let bookingId: number;

  test.beforeAll(async () => {
    if (!hasAuthConfig()) return;
    clientId = await seedProfile(EMAIL_SMS_A, PHONE_CLIENT_A);
    bookingId = await seedBooking(clientId, { status: "confirmed" });
  });

  test.afterAll(async () => {
    if (!hasAuthConfig()) return;
    await cleanupBooking(bookingId);
  });

  test("returns 200 with TwiML, booking becomes cancelled", async ({ request }) => {
    if (!hasAuthConfig()) test.skip();

    const response = await request.post(WEBHOOK_URL, {
      data: twilioBody(PHONE_CLIENT_A, "CANCEL"),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    expect(response.status()).toBe(200);

    const xml = await response.text();
    expect(xml.toLowerCase()).toContain("cancelled");

    const status = await getBookingStatus(bookingId);
    expect(status).toBe("cancelled");
  });
});

/* ================================================================== */
/*  (3) Case-insensitive: 'confirm' (lowercase) works                 */
/* ================================================================== */

test.describe("(3) Case-insensitive command", () => {
  let clientId: string;
  let bookingId: number;

  test.beforeAll(async () => {
    if (!hasAuthConfig()) return;
    clientId = await seedProfile(EMAIL_SMS_A, PHONE_CLIENT_A);
    bookingId = await seedBooking(clientId, { status: "pending" });
  });

  test.afterAll(async () => {
    if (!hasAuthConfig()) return;
    await cleanupBooking(bookingId);
  });

  test("lowercase 'confirm' is treated as CONFIRM", async ({ request }) => {
    if (!hasAuthConfig()) test.skip();

    const response = await request.post(WEBHOOK_URL, {
      data: twilioBody(PHONE_CLIENT_A, "confirm"),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    expect(response.status()).toBe(200);
    const xml = await response.text();
    expect(xml.toLowerCase()).toContain("confirmed");

    const status = await getBookingStatus(bookingId);
    expect(status).toBe("confirmed");
  });

  test("lowercase 'x' is treated as CANCEL", async ({ request }) => {
    if (!hasAuthConfig()) test.skip();

    // Re-seed as pending so cancel has something to act on
    const anotherBookingId = await seedBooking(clientId, { status: "pending" });

    const response = await request.post(WEBHOOK_URL, {
      data: twilioBody(PHONE_CLIENT_A, "x"),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    expect(response.status()).toBe(200);
    const xml = await response.text();
    expect(xml.toLowerCase()).toContain("cancelled");

    const status = await getBookingStatus(anotherBookingId);
    expect(status).toBe("cancelled");

    await cleanupBooking(anotherBookingId);
  });
});

/* ================================================================== */
/*  (4) Unknown message → instructions reply                          */
/* ================================================================== */

test.describe("(4) Unknown message body", () => {
  test("'hello' returns 200 with instructions", async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      data: twilioBody(PHONE_UNKNOWN, "hello"),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    // Always 200 — Twilio requires it
    expect(response.status()).toBe(200);

    const xml = await response.text();
    // Route replies with help instructions before even looking up the phone
    expect(xml).toContain("<Message>");
    expect(xml.toLowerCase()).toMatch(/reply c|confirm|cancel/);
  });

  test("'YES' (not a recognized command) returns instructions", async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      data: twilioBody(PHONE_UNKNOWN, "YES"),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    expect(response.status()).toBe(200);
    const xml = await response.text();
    expect(xml.toLowerCase()).toMatch(/reply c|confirm|cancel/);
  });
});

/* ================================================================== */
/*  (5) Unknown phone number                                           */
/* ================================================================== */

test.describe("(5) Unknown phone number", () => {
  test("'C' from unregistered number replies with 'could not find'", async ({ request }) => {
    const response = await request.post(WEBHOOK_URL, {
      data: twilioBody(PHONE_UNKNOWN, "C"),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    expect(response.status()).toBe(200);

    const xml = await response.text();
    // Route: "We couldn't find an account linked to this phone number."
    expect(xml.toLowerCase()).toMatch(/couldn.t find|could not find/);
  });

  test("'CANCEL' from unregistered number also replies with 'could not find'", async ({
    request,
  }) => {
    const response = await request.post(WEBHOOK_URL, {
      data: twilioBody(PHONE_UNKNOWN, "CANCEL"),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    expect(response.status()).toBe(200);
    const xml = await response.text();
    expect(xml.toLowerCase()).toMatch(/couldn.t find|could not find/);
  });
});

/* ================================================================== */
/*  (6) No upcoming booking                                            */
/* ================================================================== */

test.describe("(6) Client exists but no upcoming bookings", () => {
  let clientId: string;

  test.beforeAll(async () => {
    if (!hasAuthConfig()) return;
    // CLIENT_B has no bookings seeded in this suite
    clientId = await seedProfile(EMAIL_SMS_B, PHONE_CLIENT_B);
  });

  test("'C' replies with no upcoming bookings message", async ({ request }) => {
    if (!hasAuthConfig()) test.skip();

    const response = await request.post(WEBHOOK_URL, {
      data: twilioBody(PHONE_CLIENT_B, "C"),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    expect(response.status()).toBe(200);

    const xml = await response.text();
    // Route: "You don't have any upcoming bookings to confirm."
    expect(xml.toLowerCase()).toMatch(/don.t have any upcoming|no upcoming/);
  });

  test("'CANCEL' also replies with no upcoming bookings message", async ({ request }) => {
    if (!hasAuthConfig()) test.skip();

    const response = await request.post(WEBHOOK_URL, {
      data: twilioBody(PHONE_CLIENT_B, "CANCEL"),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    expect(response.status()).toBe(200);
    const xml = await response.text();
    expect(xml.toLowerCase()).toMatch(/don.t have any upcoming|no upcoming/);
  });

  test("past booking (already started) is not returned", async ({ request }) => {
    if (!hasAuthConfig()) test.skip();

    // Seed a booking that started in the past
    const pastBookingId = await seedBooking(clientId, {
      status: "pending",
      startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const response = await request.post(WEBHOOK_URL, {
      data: twilioBody(PHONE_CLIENT_B, "C"),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    expect(response.status()).toBe(200);
    const xml = await response.text();
    // Past booking should not match — reply still says no upcoming
    expect(xml.toLowerCase()).toMatch(/don.t have any upcoming|no upcoming/);

    await cleanupBooking(pastBookingId);
  });
});

/* ================================================================== */
/*  (7) Multiple upcoming bookings → confirms the soonest             */
/* ================================================================== */

test.describe("(7) Multiple upcoming bookings — confirms next (soonest)", () => {
  let clientId: string;
  let soonBookingId: number;
  let laterBookingId: number;

  test.beforeAll(async () => {
    if (!hasAuthConfig()) return;

    clientId = await seedProfile(EMAIL_SMS_A, PHONE_CLIENT_A);

    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h out
    const later = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 h out

    // Insert in reverse order to ensure ORDER BY wins, not insertion order
    laterBookingId = await seedBooking(clientId, { status: "pending", startsAt: later });
    soonBookingId = await seedBooking(clientId, { status: "pending", startsAt: soon });
  });

  test.afterAll(async () => {
    if (!hasAuthConfig()) return;
    await Promise.all([cleanupBooking(soonBookingId), cleanupBooking(laterBookingId)]);
  });

  test("'C' confirms only the soonest booking, later booking stays pending", async ({
    request,
  }) => {
    if (!hasAuthConfig()) test.skip();

    const response = await request.post(WEBHOOK_URL, {
      data: twilioBody(PHONE_CLIENT_A, "C"),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    expect(response.status()).toBe(200);
    const xml = await response.text();
    expect(xml.toLowerCase()).toContain("confirmed");

    const [soonStatus, laterStatus] = await Promise.all([
      getBookingStatus(soonBookingId),
      getBookingStatus(laterBookingId),
    ]);

    expect(soonStatus).toBe("confirmed");
    expect(laterStatus).toBe("pending");
  });

  test("'CANCEL' cancels only the soonest booking when multiple exist", async ({ request }) => {
    if (!hasAuthConfig()) test.skip();

    // Re-seed the soon booking as confirmed so cancel has something to act on
    // (the previous test already confirmed it; cancel accepts confirmed bookings)
    const response = await request.post(WEBHOOK_URL, {
      data: twilioBody(PHONE_CLIENT_A, "CANCEL"),
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });

    expect(response.status()).toBe(200);
    const xml = await response.text();
    expect(xml.toLowerCase()).toContain("cancelled");

    const [soonStatus, laterStatus] = await Promise.all([
      getBookingStatus(soonBookingId),
      getBookingStatus(laterBookingId),
    ]);

    expect(soonStatus).toBe("cancelled");
    expect(laterStatus).toBe("pending");
  });
});
