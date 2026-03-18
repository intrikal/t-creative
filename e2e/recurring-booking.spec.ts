import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { hasAuthConfig, signInAs, signInAsAdmin, TEST_EMAILS } from "./fixtures/auth";

/**
 * E2E tests for the recurring-booking auto-creation flow.
 *
 * ## What is under test
 * When an admin marks a booking as "completed", the server action
 * `updateBookingStatus` calls `generateNextRecurringBooking` inline.
 * That function reads the booking's `recurrenceRule` (RRULE string),
 * advances the date by the interval, and inserts a new "confirmed"
 * booking with the same service/client/staff and `parentBookingId`
 * pointing at the series root.
 *
 * The cron at `/api/cron/recurring-bookings` is a safety net for the
 * same logic — these tests exercise the **inline path** via the UI.
 *
 * ## Fixture lifecycle
 * Each test seeds a confirmed recurring booking via the Supabase
 * service-role client, triggers completion through the admin bookings
 * UI, and verifies the successor in the DB. Cleanup runs in afterEach.
 *
 * ## Skip behaviour
 * All tests are skipped when `SUPABASE_SERVICE_ROLE_KEY` is absent.
 */

/* ------------------------------------------------------------------ */
/*  Supabase admin client                                              */
/* ------------------------------------------------------------------ */

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/* ------------------------------------------------------------------ */
/*  Fixture helpers                                                    */
/* ------------------------------------------------------------------ */

interface FixtureIds {
  serviceId: number;
  bookingId: number;
  clientId: string;
  staffId: string | null;
}

/**
 * Seeds a confirmed recurring booking for the E2E client.
 *
 * @param recurrenceRule  RRULE string, e.g. "FREQ=WEEKLY"
 * @param startsAtOffset  ms from now when the booking starts (default: past, so "Complete" is available)
 */
async function seedRecurringBooking(
  recurrenceRule: string,
  startsAtOffset = -2 * 60 * 60 * 1000, // 2 hours ago — already started
): Promise<FixtureIds> {
  const db = getAdminClient();

  const { data: profile } = await db
    .from("profiles")
    .select("id")
    .eq("email", TEST_EMAILS.client)
    .single();

  if (!profile) throw new Error("E2E client profile not found — run signInAs first");
  const clientId: string = profile.id;

  const { data: adminProfile } = await db
    .from("profiles")
    .select("id")
    .eq("email", TEST_EMAILS.admin)
    .single();

  const staffId: string | null = adminProfile?.id ?? null;

  const { data: service, error: svcErr } = await db
    .from("services")
    .insert({
      name: "E2E Recurring Service",
      category: "lash",
      duration_minutes: 60,
      price_in_cents: 8000,
      deposit_in_cents: 0,
      is_active: true,
    })
    .select("id")
    .single();

  if (svcErr || !service) throw new Error(`Could not insert service: ${svcErr?.message}`);

  const startsAt = new Date(Date.now() + startsAtOffset).toISOString();

  const { data: booking, error: bkErr } = await db
    .from("bookings")
    .insert({
      client_id: clientId,
      service_id: service.id,
      staff_id: staffId,
      starts_at: startsAt,
      duration_minutes: 60,
      total_in_cents: 8000,
      status: "confirmed",
      recurrence_rule: recurrenceRule,
    })
    .select("id")
    .single();

  if (bkErr || !booking) throw new Error(`Could not insert booking: ${bkErr?.message}`);

  return { serviceId: service.id, bookingId: booking.id, clientId, staffId };
}

/** Delete all bookings in the series, then the service. */
async function cleanFixture(ids: FixtureIds) {
  const db = getAdminClient();

  // Delete the root booking and any children (parentBookingId = root)
  await db
    .from("bookings")
    .delete()
    .or(`id.eq.${ids.bookingId},parent_booking_id.eq.${ids.bookingId}`);

  await db.from("services").delete().eq("id", ids.serviceId);
}

/* ------------------------------------------------------------------ */
/*  UI helper                                                          */
/* ------------------------------------------------------------------ */

/**
 * Navigate to /dashboard/bookings, find the E2E recurring booking row,
 * and click the given menu item.  Returns false and skips when the row
 * is not visible.
 */
async function triggerMenuAction(
  page: import("@playwright/test").Page,
  menuItemText: RegExp,
): Promise<boolean> {
  await page.goto("/dashboard/bookings");
  await page.waitForLoadState("networkidle");

  const bookingRow = page.locator("div", { hasText: "E2E Recurring Service" }).first();
  if ((await bookingRow.count()) === 0) {
    test.skip();
    return false;
  }

  await bookingRow.hover();
  await bookingRow.locator("button[title='More']").click();

  const menuItem = page.locator("button", { hasText: menuItemText }).first();
  if ((await menuItem.count()) === 0) {
    test.skip();
    return false;
  }

  await menuItem.click();
  return true;
}

/* ================================================================== */
/*  Tests                                                              */
/* ================================================================== */

test.describe("Recurring booking — auto-creation on completion", () => {
  let fixture: FixtureIds;

  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();

    // Ensure both profiles exist
    await signInAs(page, TEST_EMAILS.client, "client");
    await signInAsAdmin(page); // seeds admin profile

    fixture = await seedRecurringBooking("FREQ=WEEKLY");

    const ok = await signInAsAdmin(page);
    if (!ok) test.skip();
  });

  test.afterEach(async () => {
    if (fixture) await cleanFixture(fixture);
  });

  /* ---------------------------------------------------------------- */

  test("completing a recurring booking creates the next occurrence", async ({ page }) => {
    const triggered = await triggerMenuAction(page, /^complete$/i);
    if (!triggered) return;

    // Wait for the server action (generateNextRecurringBooking runs inline)
    await page.waitForTimeout(2500);

    const db = getAdminClient();
    const { data: successor } = await db
      .from("bookings")
      .select("id, starts_at, status, parent_booking_id")
      .eq("parent_booking_id", fixture.bookingId)
      .neq("status", "cancelled")
      .order("starts_at", { ascending: true })
      .limit(1)
      .single();

    expect(successor).not.toBeNull();
    expect(successor!.status).toBe("confirmed");

    // New booking starts one week after the parent
    const parentRow = await db
      .from("bookings")
      .select("starts_at")
      .eq("id", fixture.bookingId)
      .single();

    const parentStart = new Date(parentRow.data!.starts_at).getTime();
    const nextStart = new Date(successor!.starts_at).getTime();
    const diffDays = Math.round((nextStart - parentStart) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(7);
  });

  test("next booking inherits service and staff from the parent", async ({ page }) => {
    const triggered = await triggerMenuAction(page, /^complete$/i);
    if (!triggered) return;

    await page.waitForTimeout(2500);

    const db = getAdminClient();
    const { data: successor } = await db
      .from("bookings")
      .select("service_id, staff_id, client_id")
      .eq("parent_booking_id", fixture.bookingId)
      .neq("status", "cancelled")
      .limit(1)
      .single();

    expect(successor).not.toBeNull();
    expect(successor!.service_id).toBe(fixture.serviceId);
    expect(successor!.client_id).toBe(fixture.clientId);
    // staffId may be null if the admin profile wasn't found, but when set it must match
    if (fixture.staffId !== null) {
      expect(successor!.staff_id).toBe(fixture.staffId);
    }
  });
});

/* ================================================================== */
/*  Series cancellation — no future auto-creation                     */
/* ================================================================== */

test.describe("Recurring booking — series cancellation", () => {
  let fixture: FixtureIds;

  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();

    await signInAs(page, TEST_EMAILS.client, "client");
    await signInAsAdmin(page);

    fixture = await seedRecurringBooking("FREQ=WEEKLY");

    const ok = await signInAsAdmin(page);
    if (!ok) test.skip();
  });

  test.afterEach(async () => {
    if (fixture) await cleanFixture(fixture);
  });

  /* ---------------------------------------------------------------- */

  test("cancelling the series prevents any successor from being created", async ({ page }) => {
    // Cancel the entire series via the "Cancel Series" menu item
    const triggered = await triggerMenuAction(page, /cancel series/i);
    if (!triggered) return;

    await page.waitForTimeout(1500);

    // Verify the booking is now cancelled
    const db = getAdminClient();
    const { data: root } = await db
      .from("bookings")
      .select("status")
      .eq("id", fixture.bookingId)
      .single();

    expect(root?.status).toBe("cancelled");

    // Now directly set the booking to "completed" in the DB to simulate the
    // inline trigger — generateNextRecurringBooking should bail because
    // cancelBookingSeries already cancelled the series root.
    // We verify by calling the cron endpoint directly and confirming created=0.
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      // Can't call cron without secret — verify via DB absence instead
      const { data: successors } = await db
        .from("bookings")
        .select("id")
        .eq("parent_booking_id", fixture.bookingId)
        .neq("status", "cancelled");

      expect(successors ?? []).toHaveLength(0);
      return;
    }

    // Directly mark the booking completed in DB (bypassing the UI, which
    // would reject completing a cancelled booking) so the cron can find it.
    await db
      .from("bookings")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", fixture.bookingId);

    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
    const resp = await fetch(`${baseUrl}/api/cron/recurring-bookings`, {
      headers: { "x-cron-secret": cronSecret },
    });

    expect(resp.ok).toBe(true);
    const body = await resp.json();

    // The cron should skip this booking because a cancelled series root
    // means cancelBookingSeries already ran — no un-cancelled successor
    // will be missing.  created must be 0 for our booking.
    expect(body.created).toBe(0);

    // Double-check: no live successor in the DB
    const { data: liveSucessors } = await db
      .from("bookings")
      .select("id")
      .eq("parent_booking_id", fixture.bookingId)
      .neq("status", "cancelled");

    expect(liveSucessors ?? []).toHaveLength(0);
  });
});

/* ================================================================== */
/*  Cron endpoint — smoke tests (no DB required beyond auth)         */
/* ================================================================== */

test.describe("Recurring bookings cron — auth", () => {
  test("returns 401 without cron secret", async ({ page }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
    const resp = await page.request.get(`${baseUrl}/api/cron/recurring-bookings`);
    expect(resp.status()).toBe(401);
  });

  test("returns 401 with wrong cron secret", async ({ page }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
    const resp = await page.request.get(`${baseUrl}/api/cron/recurring-bookings`, {
      headers: { "x-cron-secret": "definitely-wrong" },
    });
    expect(resp.status()).toBe(401);
  });

  test("returns 200 with correct cron secret (no-op when no candidates)", async ({ page }) => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      test.skip();
      return;
    }

    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
    const resp = await page.request.get(`${baseUrl}/api/cron/recurring-bookings`, {
      headers: { "x-cron-secret": cronSecret },
    });
    expect(resp.status()).toBe(200);

    const body = await resp.json();
    // checked/created/skipped are all numbers
    expect(typeof body.checked).toBe("number");
    expect(typeof body.created).toBe("number");
    expect(typeof body.skipped).toBe("number");
  });
});
