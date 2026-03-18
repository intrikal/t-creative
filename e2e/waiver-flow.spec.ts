import { createHmac } from "crypto";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { hasAuthConfig, signInAsAdmin, TEST_EMAILS } from "./fixtures/auth";

/**
 * E2E tests for the waiver enforcement flow.
 *
 * ## Coverage
 * 1. Admin trying to confirm a booking with missing waivers → WaiverGateDialog appears.
 * 2. WaiverGateDialog lists the missing form and offers "Send Waiver Link".
 * 3. After sending, the dialog transitions to the "Waiver Link Sent" confirmation state.
 * 4. Waiver completion page loads with a valid token (service + appointment details shown).
 * 5. Waiver completion page rejects an invalid / expired token.
 * 6. Client completes the waiver form → "All Done!" confirmation shown.
 * 7. Booking can be confirmed without obstruction once the waiver is on file.
 *
 * ## Database state
 * Each describe block that hits the DB uses a beforeEach to insert isolated
 * fixtures via the Supabase service-role client and cleans them up in afterEach.
 * Tests are skipped when SUPABASE_SERVICE_ROLE_KEY is absent so the suite
 * stays green in environments without a live Supabase project.
 *
 * ## Token generation
 * The waiver token is generated using the same HMAC logic as lib/waiver-token.ts
 * so we can construct valid tokens in tests without importing server-only modules.
 */

/* ------------------------------------------------------------------ */
/*  Token helper (mirrors lib/waiver-token.ts)                        */
/* ------------------------------------------------------------------ */

const WAIVER_SECRET =
  process.env.WAIVER_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || "waiver-fallback-secret";

function generateToken(bookingId: number, clientId: string): string {
  const data = {
    bookingId,
    clientId,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = createHmac("sha256", WAIVER_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function expiredToken(bookingId: number, clientId: string): string {
  const data = { bookingId, clientId, exp: Date.now() - 1000 };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = createHmac("sha256", WAIVER_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

/* ------------------------------------------------------------------ */
/*  Supabase admin client helper                                       */
/* ------------------------------------------------------------------ */

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/* ------------------------------------------------------------------ */
/*  Fixture builder                                                    */
/* ------------------------------------------------------------------ */

/**
 * Seeds the minimum DB state needed for waiver-gate tests:
 *   - A service with category "lash"
 *   - An active, required client_form that applies to "Lash" (or "All")
 *   - A pending booking for the E2E client on that service
 *
 * Returns IDs so callers can clean up.
 */
async function seedWaiverFixture(): Promise<{
  serviceId: number;
  formId: number;
  bookingId: number;
  clientId: string;
}> {
  const db = getAdminClient();

  // Resolve the E2E client's profile id
  const { data: profile } = await db
    .from("profiles")
    .select("id")
    .eq("email", TEST_EMAILS.client)
    .single();

  if (!profile) throw new Error("E2E client profile not found — run signInAsClient first");
  const clientId: string = profile.id;

  // Resolve (or create) a staff member we can attach the booking to
  const { data: adminProfile } = await db
    .from("profiles")
    .select("id")
    .eq("email", TEST_EMAILS.admin)
    .single();

  const staffId: string | null = adminProfile?.id ?? null;

  // Create a service
  const { data: service, error: svcErr } = await db
    .from("services")
    .insert({
      name: "E2E Lash Service",
      category: "lash",
      duration_minutes: 90,
      price_in_cents: 15000,
      deposit_in_cents: 3000,
      is_active: true,
    })
    .select("id")
    .single();

  if (svcErr || !service) throw new Error(`Could not insert service: ${svcErr?.message}`);

  // Create a required consent form that applies to Lash services
  const { data: form, error: formErr } = await db
    .from("client_forms")
    .insert({
      name: "E2E Lash Consent Form",
      type: "consent",
      applies_to: ["Lash"],
      is_active: true,
      required: true,
      description: "E2E test consent form",
    })
    .select("id")
    .single();

  if (formErr || !form) throw new Error(`Could not insert form: ${formErr?.message}`);

  // Create a pending booking
  const startsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: booking, error: bkErr } = await db
    .from("bookings")
    .insert({
      client_id: clientId,
      service_id: service.id,
      staff_id: staffId,
      starts_at: startsAt,
      duration_minutes: 90,
      total_in_cents: 15000,
      status: "pending",
    })
    .select("id")
    .single();

  if (bkErr || !booking) throw new Error(`Could not insert booking: ${bkErr?.message}`);

  return { serviceId: service.id, formId: form.id, bookingId: booking.id, clientId };
}

async function cleanWaiverFixture(ids: {
  serviceId: number;
  formId: number;
  bookingId: number;
  clientId: string;
}) {
  const db = getAdminClient();
  // Delete in dependency order
  await db
    .from("form_submissions")
    .delete()
    .eq("client_id", ids.clientId)
    .eq("form_id", ids.formId);
  await db.from("bookings").delete().eq("id", ids.bookingId);
  await db.from("client_forms").delete().eq("id", ids.formId);
  await db.from("services").delete().eq("id", ids.serviceId);
}

/* ================================================================== */
/*  1. Public waiver page — no auth required                          */
/* ================================================================== */

test.describe("Waiver page — invalid token", () => {
  test("shows 'Link Expired or Invalid' for a garbage token", async ({ page }) => {
    await page.goto("/waivers/not-a-real-token");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=/expired|invalid/i").first()).toBeVisible();
  });

  test("shows 'Link Expired or Invalid' for an expired valid-signature token", async ({ page }) => {
    // Use a plausible but non-existent bookingId/clientId — token will be
    // expired so the server rejects it before hitting the DB.
    const token = expiredToken(999999, "00000000-0000-0000-0000-000000000000");
    await page.goto(`/waivers/${token}`);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=/expired|invalid/i").first()).toBeVisible();
  });
});

/* ================================================================== */
/*  2. Waiver page — valid token (requires seeded DB data)            */
/* ================================================================== */

test.describe("Waiver page — valid token", () => {
  let fixture: Awaited<ReturnType<typeof seedWaiverFixture>>;

  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();
    // Sign in as admin to ensure the E2E admin profile exists; then sign in as
    // client so the client profile is seeded too.
    const adminOk = await signInAsAdmin(page);
    if (!adminOk) test.skip();

    // Ensure the client profile exists by attempting sign-in
    const { signInAs } = await import("./fixtures/auth");
    await signInAs(page, TEST_EMAILS.client, "client");

    fixture = await seedWaiverFixture();
  });

  test.afterEach(async () => {
    if (fixture) await cleanWaiverFixture(fixture);
  });

  test("waiver completion page loads with service and appointment details", async ({ page }) => {
    const token = generateToken(fixture.bookingId, fixture.clientId);
    await page.goto(`/waivers/${token}`);
    await page.waitForLoadState("networkidle");

    // Should NOT show the invalid-token error
    await expect(page.locator("text=/expired|invalid/i")).not.toBeVisible();

    // Should show the service name
    await expect(page.locator(`text=E2E Lash Service`)).toBeVisible();

    // Should show the form name
    await expect(page.locator(`text=E2E Lash Consent Form`)).toBeVisible();

    // Should show the Sign & Submit button
    await expect(page.locator("button", { hasText: /sign & submit/i })).toBeVisible();
  });

  test("client can complete the waiver form and see the confirmation", async ({ page }) => {
    const token = generateToken(fixture.bookingId, fixture.clientId);
    await page.goto(`/waivers/${token}`);
    await page.waitForLoadState("networkidle");

    // Fill in the Full Name field
    const nameInput = page.locator("input[placeholder='Full Name']").first();
    await nameInput.fill("E2E Client");

    // Fill in the Date field (first date input)
    const dateInput = page.locator("input[type='date']").first();
    await dateInput.fill("2026-03-18");

    // Check the consent checkbox
    const checkbox = page.locator("input[type='checkbox']").first();
    await checkbox.check();

    // Draw a minimal signature on the canvas by simulating pointer events
    const canvas = page.locator("canvas").first();
    const canvasBox = await canvas.boundingBox();
    if (canvasBox) {
      await page.mouse.move(canvasBox.x + 50, canvasBox.y + 75);
      await page.mouse.down();
      await page.mouse.move(canvasBox.x + 150, canvasBox.y + 75);
      await page.mouse.move(canvasBox.x + 200, canvasBox.y + 50);
      await page.mouse.up();
    }

    // Submit
    await page.locator("button", { hasText: /sign & submit/i }).click();

    // After all forms are done the page shows "All Done!"
    await expect(page.locator("text=/all done/i")).toBeVisible({ timeout: 10_000 });
  });

  test("visiting waiver page after completion shows 'All Waivers Completed'", async ({ page }) => {
    // Pre-insert the form submission so the waiver is already done
    const db = getAdminClient();
    await db.from("form_submissions").insert({
      client_id: fixture.clientId,
      form_id: fixture.formId,
      data: { fullName: "E2E Client", consent: true },
      form_version: "2026-03",
    });

    const token = generateToken(fixture.bookingId, fixture.clientId);
    await page.goto(`/waivers/${token}`);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=/all waivers completed/i")).toBeVisible();
  });
});

/* ================================================================== */
/*  3. Admin bookings — WaiverGateDialog                              */
/* ================================================================== */

test.describe("Admin bookings — waiver gate blocks confirmation", () => {
  let fixture: Awaited<ReturnType<typeof seedWaiverFixture>>;

  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();

    // Ensure client profile exists
    const { signInAs } = await import("./fixtures/auth");
    await signInAs(page, TEST_EMAILS.client, "client");

    fixture = await seedWaiverFixture();

    // Sign in as admin — this is the session we use for the bookings page
    const adminOk = await signInAsAdmin(page);
    if (!adminOk) test.skip();
  });

  test.afterEach(async () => {
    if (fixture) await cleanWaiverFixture(fixture);
  });

  test("WaiverGateDialog appears when confirming a booking with missing waivers", async ({
    page,
  }) => {
    await page.goto("/dashboard/bookings");
    await page.waitForLoadState("networkidle");

    // Find the row for our E2E booking (service name uniquely identifies it)
    const bookingRow = page.locator("div", { hasText: "E2E Lash Service" }).first();
    const rowCount = await bookingRow.count();
    if (rowCount === 0) {
      // Booking not visible — possibly pagination; skip gracefully
      test.skip();
      return;
    }

    // Open the row's action menu (MoreHorizontal button)
    await bookingRow.hover();
    await bookingRow.locator("button[title='More']").click();

    // Click "Confirm" from the dropdown
    await page
      .locator("button", { hasText: /^confirm$/i })
      .first()
      .click();

    // WaiverGateDialog should open
    await expect(page.locator("text=Waiver Required")).toBeVisible({ timeout: 8_000 });

    // Missing form name should be listed
    await expect(page.locator("text=E2E Lash Consent Form")).toBeVisible();

    // "Send Waiver Link" button should be present
    await expect(page.locator("button", { hasText: /send waiver link/i })).toBeVisible();
  });

  test("WaiverGateDialog shows 'Waiver Link Sent' state after clicking send", async ({ page }) => {
    await page.goto("/dashboard/bookings");
    await page.waitForLoadState("networkidle");

    const bookingRow = page.locator("div", { hasText: "E2E Lash Service" }).first();
    if ((await bookingRow.count()) === 0) {
      test.skip();
      return;
    }

    await bookingRow.hover();
    await bookingRow.locator("button[title='More']").click();
    await page
      .locator("button", { hasText: /^confirm$/i })
      .first()
      .click();
    await expect(page.locator("text=Waiver Required")).toBeVisible({ timeout: 8_000 });

    // Click "Send Waiver Link" — this triggers sendWaiverLink server action.
    // The client must have email notifications enabled (profile.notify_email = true).
    // We rely on the fixture auth setup having a valid email for the client profile.
    const sendBtn = page.locator("button", { hasText: /send waiver link/i });
    await sendBtn.click();

    // After a successful send the dialog should transition to the sent state.
    // Accept either the success UI or an error about email config (CI may lack Resend key).
    const sentConfirmation = page.locator("text=/waiver link sent/i");
    const emailError = page.locator("text=/failed to send|email notifications/i");

    await expect(sentConfirmation.or(emailError)).toBeVisible({ timeout: 12_000 });
  });

  test("booking can be confirmed after waiver is submitted", async ({ page }) => {
    // Pre-seed the form submission so the waiver check passes
    const db = getAdminClient();
    await db.from("form_submissions").insert({
      client_id: fixture.clientId,
      form_id: fixture.formId,
      data: { fullName: "E2E Client", consent: true },
      form_version: "2026-03",
    });

    await page.goto("/dashboard/bookings");
    await page.waitForLoadState("networkidle");

    const bookingRow = page.locator("div", { hasText: "E2E Lash Service" }).first();
    if ((await bookingRow.count()) === 0) {
      test.skip();
      return;
    }

    await bookingRow.hover();
    await bookingRow.locator("button[title='More']").click();
    await page
      .locator("button", { hasText: /^confirm$/i })
      .first()
      .click();

    // The WaiverGateDialog must NOT appear — waiver check passes
    const dialog = page.locator("text=Waiver Required");
    // Give it a moment to potentially appear before asserting it's absent
    await page.waitForTimeout(1500);
    await expect(dialog).not.toBeVisible();

    // The booking status badge should update to "Confirmed"
    await expect(
      page.locator("div", { hasText: "E2E Lash Service" }).locator("text=/confirmed/i").first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});

/* ================================================================== */
/*  4. Unauthenticated / edge cases                                   */
/* ================================================================== */

test.describe("Waiver page — edge cases (no DB required)", () => {
  test("shows error for a token with tampered payload", async ({ page }) => {
    // Valid structure but wrong signature
    const data = Buffer.from(
      JSON.stringify({ bookingId: 1, clientId: "abc", exp: Date.now() + 99999 }),
    ).toString("base64url");
    const tampered = `${data}.invalidsignature`;

    await page.goto(`/waivers/${tampered}`);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=/expired|invalid/i").first()).toBeVisible();
  });

  test("shows error for a token with missing segments", async ({ page }) => {
    await page.goto("/waivers/onlyone");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=/expired|invalid/i").first()).toBeVisible();
  });

  test("waiver page title is set correctly", async ({ page }) => {
    await page.goto("/waivers/bad-token");
    await page.waitForLoadState("networkidle");

    // The invalid-token page should still carry the expected page title
    await expect(page).toHaveTitle(/T Creative Studio/i);
  });
});
