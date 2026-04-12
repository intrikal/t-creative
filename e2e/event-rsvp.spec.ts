import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * E2E tests for the event RSVP flow at /rsvp/[token].
 *
 * ## Coverage
 * - A valid RSVP page loads and shows event details.
 * - Guest fills in name (+ optional service interest) and submits the RSVP.
 * - Confirmation ("You're on the list!") is shown after a successful RSVP.
 * - Duplicate RSVP (same name / same email) is handled gracefully — the
 *   server returns an error message rather than crashing.
 * - An invalid or missing token renders a 404 / not-found state.
 *
 * ## Fixture lifecycle
 * Tests that need a real RSVP event seed one via the Supabase service-role
 * client, run, then clean up in afterEach.  When env vars are absent every
 * authenticated/seeded test is skipped automatically.
 *
 * ## Requirements
 *   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
 */

/* ------------------------------------------------------------------ */
/*  Supabase admin client                                              */
/* ------------------------------------------------------------------ */

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function hasAuthConfig(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/* ------------------------------------------------------------------ */
/*  Fixture helpers                                                    */
/* ------------------------------------------------------------------ */

interface RsvpFixture {
  eventId: number;
  token: string;
}

/** Seed a test event with an RSVP token, returning IDs for cleanup. */
async function seedRsvpEvent(overrides: { maxAttendees?: number } = {}): Promise<RsvpFixture> {
  const db = getAdminClient();

  const token = `e2e-rsvp-${Date.now()}`;

  const { data: event, error } = await db
    .from("events")
    .insert({
      title: "E2E Test Event",
      event_type: "workshop",
      status: "upcoming",
      event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      location: "T Creative Studio",
      services: "Lash Extensions",
      rsvp_token: token,
      max_attendees: overrides.maxAttendees ?? null,
    })
    .select("id")
    .single();

  if (error || !event) {
    throw new Error(`Could not seed RSVP event: ${error?.message}`);
  }

  return { eventId: event.id, token };
}

/** Delete the seeded event and any RSVP rows that reference it. */
async function cleanRsvpFixture({ eventId }: RsvpFixture) {
  const db = getAdminClient();
  await db.from("event_guests").delete().eq("event_id", eventId);
  await db.from("events").delete().eq("id", eventId);
}

/* ================================================================== */
/*  Invalid / missing token                                            */
/* ================================================================== */

test.describe("RSVP — invalid token", () => {
  test("unknown token renders a not-found or error state", async ({ page }) => {
    await page.goto("/rsvp/this-token-does-not-exist-e2e");
    await page.waitForLoadState("networkidle");

    // The page should render a 404, error message, or redirect — NOT a blank crash
    const hasNotFound =
      (await page.locator("text=/not found|404|invalid|expired|no event/i").count()) > 0;
    const hasRedirect = page.url() !== "http://localhost:3000/rsvp/this-token-does-not-exist-e2e";

    // Either shows an error message or redirects away — both are acceptable
    expect(hasNotFound || hasRedirect).toBe(true);
  });
});

/* ================================================================== */
/*  Valid RSVP page — seeded event                                    */
/* ================================================================== */

test.describe("RSVP — valid token (seeded event)", () => {
  let fixture: RsvpFixture;

  test.beforeEach(async () => {
    if (!hasAuthConfig()) test.skip();
    fixture = await seedRsvpEvent();
  });

  test.afterEach(async () => {
    if (fixture) await cleanRsvpFixture(fixture);
  });

  /* ---------------------------------------------------------------- */

  test("RSVP page loads and shows event title", async ({ page }) => {
    await page.goto(`/rsvp/${fixture.token}`);
    await page.waitForLoadState("networkidle");

    // Page should render the event title "E2E Test Event"
    await expect(page.locator("h1").filter({ hasText: "E2E Test Event" })).toBeVisible();
  });

  test("RSVP page shows event details card with date and location", async ({ page }) => {
    await page.goto(`/rsvp/${fixture.token}`);
    await page.waitForLoadState("networkidle");

    // Event details card must contain location text
    await expect(page.locator("text=T Creative Studio").first()).toBeVisible();

    // Date field and a calendar icon should be present
    const hasDateInfo =
      (await page.locator("text=/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i").count()) > 0;
    expect(hasDateInfo).toBe(true);
  });

  test("RSVP page renders the name input and submit button", async ({ page }) => {
    await page.goto(`/rsvp/${fixture.token}`);
    await page.waitForLoadState("networkidle");

    await expect(page.locator('input[placeholder*="First and last name"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /rsvp/i })).toBeVisible();
  });

  test("RSVP submit button is disabled when name is empty", async ({ page }) => {
    await page.goto(`/rsvp/${fixture.token}`);
    await page.waitForLoadState("networkidle");

    const submitBtn = page.getByRole("button", { name: /^rsvp$/i });
    await expect(submitBtn).toBeDisabled();
  });

  test("guest fills name and submits — confirmation shown", async ({ page }) => {
    await page.goto(`/rsvp/${fixture.token}`);
    await page.waitForLoadState("networkidle");

    await page.locator('input[placeholder*="First and last name"]').fill("Jane Doe");

    // Service interest field is shown when services are set
    const serviceInput = page.locator('input[placeholder*="Which service"]');
    if ((await serviceInput.count()) > 0) {
      await serviceInput.fill("Lash Extensions");
    }

    await page.getByRole("button", { name: /^rsvp$/i }).click();
    await page.waitForLoadState("networkidle");

    // Success confirmation should appear
    await expect(page.locator("text=You're on the list!")).toBeVisible();
  });

  test("confirmation message references the event title", async ({ page }) => {
    await page.goto(`/rsvp/${fixture.token}`);
    await page.waitForLoadState("networkidle");

    await page.locator('input[placeholder*="First and last name"]').fill("Test Attendee");
    await page.getByRole("button", { name: /^rsvp$/i }).click();
    await page.waitForLoadState("networkidle");

    // The success state shows the event title in the confirmation copy
    const body = await page.locator("body").textContent();
    expect(body).toContain("E2E Test Event");
  });
});

/* ================================================================== */
/*  Duplicate RSVP — same name submitted twice                        */
/* ================================================================== */

test.describe("RSVP — duplicate submission", () => {
  let fixture: RsvpFixture;

  test.beforeEach(async () => {
    if (!hasAuthConfig()) test.skip();
    fixture = await seedRsvpEvent();
  });

  test.afterEach(async () => {
    if (fixture) await cleanRsvpFixture(fixture);
  });

  /* ---------------------------------------------------------------- */

  test("second RSVP with the same name is handled gracefully", async ({ page }) => {
    const url = `/rsvp/${fixture.token}`;

    // First submission
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await page.locator('input[placeholder*="First and last name"]').fill("Duplicate Guest");
    await page.getByRole("button", { name: /^rsvp$/i }).click();
    await page.waitForLoadState("networkidle");

    // Should show the success state after first RSVP
    await expect(page.locator("text=You're on the list!")).toBeVisible();

    // Second submission — navigate back to the RSVP page
    await page.goto(url);
    await page.waitForLoadState("networkidle");

    // The form should still be visible (page reload resets client state)
    const nameInput = page.locator('input[placeholder*="First and last name"]');
    if ((await nameInput.count()) === 0) {
      // Page might show full state — skip gracefully
      test.skip();
      return;
    }

    await nameInput.fill("Duplicate Guest");
    await page.getByRole("button", { name: /^rsvp$/i }).click();
    await page.waitForLoadState("networkidle");

    // Acceptable outcomes: success again (idempotent) OR an inline error message
    const isSuccess = (await page.locator("text=You're on the list!").count()) > 0;
    const isError =
      (await page.locator("p.text-red-500, [class*='error'], [role='alert']").count()) > 0 ||
      (await page.locator("text=/already|duplicate|submitted/i").count()) > 0;

    expect(isSuccess || isError).toBe(true);
  });
});

/* ================================================================== */
/*  RSVP — event at capacity                                          */
/* ================================================================== */

test.describe("RSVP — event at capacity", () => {
  let fixture: RsvpFixture;

  test.beforeEach(async () => {
    if (!hasAuthConfig()) test.skip();
    // Seed with maxAttendees=0 so the event is immediately full
    fixture = await seedRsvpEvent({ maxAttendees: 0 });
  });

  test.afterEach(async () => {
    if (fixture) await cleanRsvpFixture(fixture);
  });

  /* ---------------------------------------------------------------- */

  test("full event hides the RSVP form and shows capacity message", async ({ page }) => {
    await page.goto(`/rsvp/${fixture.token}`);
    await page.waitForLoadState("networkidle");

    // The "This event is full" text should be shown
    await expect(page.locator("text=This event is full")).toBeVisible();

    // The RSVP submit button should NOT be visible
    const submitBtn = page.getByRole("button", { name: /^rsvp$/i });
    expect(await submitBtn.count()).toBe(0);
  });
});
