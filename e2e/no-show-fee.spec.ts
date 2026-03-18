import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { hasAuthConfig, signInAsAdmin, signInAs, TEST_EMAILS } from "./fixtures/auth";

/**
 * E2E tests for the no-show / late-cancellation fee collection flow.
 *
 * ## What is under test
 * When an admin marks a booking as "no_show" (or cancels within the window),
 * the server action `tryEnforceFee` runs server-side:
 *   1. Reads `noShowFeePercent` / `lateCancelFeePercent` from `policy_settings`.
 *   2. If a Square card is on file, charges it (not testable in E2E without
 *      real Square credentials).
 *   3. Otherwise creates an `invoices` row for the fee amount.
 *
 * Because the charge path requires real Square credentials, every test here
 * exercises the **invoice path** (no card on file).  We verify outcomes in
 * the DB via the Supabase service-role client.
 *
 * ## Fixture lifecycle
 * Each test seeds its own booking + policy via `seedFixture()` and cleans up
 * in `afterEach`.  Policy settings are restored to their pre-test value.
 *
 * ## Skip behaviour
 * All tests are skipped when `SUPABASE_SERVICE_ROLE_KEY` is absent so the
 * suite remains green in environments without a live Supabase project.
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
/*  Policy helpers                                                     */
/* ------------------------------------------------------------------ */

interface PolicyPatch {
  noShowFeePercent?: number;
  lateCancelFeePercent?: number;
  cancelWindowHours?: number;
}

/** Read the current policy_settings value from the DB. */
async function readPolicies(): Promise<Record<string, unknown> | null> {
  const db = getAdminClient();
  const { data } = await db.from("settings").select("value").eq("key", "policy_settings").single();
  return (data?.value as Record<string, unknown>) ?? null;
}

/**
 * Upsert policy_settings. Returns the previous value so tests can restore it.
 */
async function setPolicies(patch: PolicyPatch): Promise<Record<string, unknown> | null> {
  const db = getAdminClient();
  const existing = await readPolicies();

  const merged = {
    cancelWindowHours: 48,
    lateCancelFeePercent: 50,
    noShowFeePercent: 100,
    depositRequired: true,
    depositPercent: 25,
    ...(existing ?? {}),
    ...patch,
  };

  await db.from("settings").upsert(
    {
      key: "policy_settings",
      label: "Policy Settings",
      description: "Cancellation and fee policies",
      value: merged,
    },
    { onConflict: "key" },
  );

  return existing;
}

async function restorePolicies(original: Record<string, unknown> | null) {
  if (!original) return;
  const db = getAdminClient();
  await db
    .from("settings")
    .upsert(
      { key: "policy_settings", label: "Policy Settings", description: "", value: original },
      { onConflict: "key" },
    );
}

/* ------------------------------------------------------------------ */
/*  Booking fixture                                                    */
/* ------------------------------------------------------------------ */

interface FixtureIds {
  serviceId: number;
  bookingId: number;
  clientId: string;
}

/**
 * Seeds a confirmed booking for the E2E client on a new lash service.
 * `startsAtOffset` controls when the booking starts relative to now (ms).
 */
async function seedBookingFixture(
  startsAtOffset = 7 * 24 * 60 * 60 * 1000,
  totalInCents = 10000,
): Promise<FixtureIds> {
  const db = getAdminClient();

  // Resolve the E2E client id (must already exist — created by signInAs)
  const { data: profile } = await db
    .from("profiles")
    .select("id")
    .eq("email", TEST_EMAILS.client)
    .single();

  if (!profile) throw new Error("E2E client profile not found — run signInAs first");
  const clientId: string = profile.id;

  // Ensure squareCustomerId is null so the invoice path is taken
  await db.from("profiles").update({ square_customer_id: null }).eq("id", clientId);

  // Create a service
  const { data: service, error: svcErr } = await db
    .from("services")
    .insert({
      name: "E2E No-Show Service",
      category: "lash",
      duration_minutes: 60,
      price_in_cents: totalInCents,
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
      staff_id: null,
      starts_at: startsAt,
      duration_minutes: 60,
      total_in_cents: totalInCents,
      status: "confirmed",
    })
    .select("id")
    .single();

  if (bkErr || !booking) throw new Error(`Could not insert booking: ${bkErr?.message}`);

  return { serviceId: service.id, bookingId: booking.id, clientId };
}

async function cleanBookingFixture(ids: FixtureIds) {
  const db = getAdminClient();
  // Remove any invoices or payments created by the fee enforcement
  await db
    .from("invoices")
    .delete()
    .eq("client_id", ids.clientId)
    .like("notes", `%booking #${ids.bookingId}%`);
  await db.from("payments").delete().eq("booking_id", ids.bookingId);
  await db.from("bookings").delete().eq("id", ids.bookingId);
  await db.from("services").delete().eq("id", ids.serviceId);
}

/* ------------------------------------------------------------------ */
/*  UI helpers                                                         */
/* ------------------------------------------------------------------ */

/**
 * On the bookings page, find the row for the E2E booking and trigger a status
 * change via the MoreHorizontal dropdown menu.
 *
 * Returns false and calls `test.skip()` when the booking row isn't visible
 * (e.g. filtered out or pagination).
 */
async function triggerStatusChange(
  page: import("@playwright/test").Page,
  menuItemText: RegExp,
): Promise<boolean> {
  await page.goto("/dashboard/bookings");
  await page.waitForLoadState("networkidle");

  const bookingRow = page.locator("div", { hasText: "E2E No-Show Service" }).first();
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
/*  Test suite                                                         */
/* ================================================================== */

test.describe("No-show fee collection", () => {
  let fixture: FixtureIds;
  let originalPolicies: Record<string, unknown> | null = null;

  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();

    // Ensure the client profile exists
    await signInAs(page, TEST_EMAILS.client, "client");

    // Seed policies and booking
    originalPolicies = await setPolicies({ noShowFeePercent: 100 });
    fixture = await seedBookingFixture();

    // Sign in as admin for the actual test
    const ok = await signInAsAdmin(page);
    if (!ok) test.skip();
  });

  test.afterEach(async () => {
    if (fixture) await cleanBookingFixture(fixture);
    await restorePolicies(originalPolicies);
  });

  /* ---------------------------------------------------------------- */

  test("marking a booking as no-show updates its status badge", async ({ page }) => {
    const triggered = await triggerStatusChange(page, /^no.?show$/i);
    if (!triggered) return;

    // The booking row status badge should update to "No-show"
    const bookingRow = page.locator("div", { hasText: "E2E No-Show Service" }).first();
    await expect(bookingRow.locator("text=/no.?show/i").first()).toBeVisible({ timeout: 10_000 });
  });

  test("marking a booking as no-show creates an invoice for the fee", async ({ page }) => {
    const triggered = await triggerStatusChange(page, /^no.?show$/i);
    if (!triggered) return;

    // Wait for the server action to complete (status badge change is the signal)
    await page.waitForTimeout(2000);

    // Verify an invoice was created in the DB for this client
    const db = getAdminClient();
    const { data: inv } = await db
      .from("invoices")
      .select("id, amount_in_cents, description, status")
      .eq("client_id", fixture.clientId)
      .like("notes", `%booking #${fixture.bookingId}%`)
      .order("id", { ascending: false })
      .limit(1)
      .single();

    expect(inv).not.toBeNull();
    expect(inv!.status).toBe("sent");
    // 100% of $100 = $100 = 10000¢
    expect(inv!.amount_in_cents).toBe(10000);
    expect(inv!.description).toMatch(/no.?show/i);
  });
});

/* ================================================================== */
/*  Fee percentage respected                                          */
/* ================================================================== */

test.describe("No-show fee — percentage calculation", () => {
  let fixture: FixtureIds;
  let originalPolicies: Record<string, unknown> | null = null;

  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();

    await signInAs(page, TEST_EMAILS.client, "client");

    // 50% fee on a $100 (10000¢) booking → $50 (5000¢) invoice
    originalPolicies = await setPolicies({ noShowFeePercent: 50 });
    fixture = await seedBookingFixture(7 * 24 * 60 * 60 * 1000, 10000);

    const ok = await signInAsAdmin(page);
    if (!ok) test.skip();
  });

  test.afterEach(async () => {
    if (fixture) await cleanBookingFixture(fixture);
    await restorePolicies(originalPolicies);
  });

  test("no-show fee respects configured percentage (50% of $100 = $50)", async ({ page }) => {
    const triggered = await triggerStatusChange(page, /^no.?show$/i);
    if (!triggered) return;

    await page.waitForTimeout(2000);

    const db = getAdminClient();
    const { data: inv } = await db
      .from("invoices")
      .select("amount_in_cents")
      .eq("client_id", fixture.clientId)
      .like("notes", `%booking #${fixture.bookingId}%`)
      .order("id", { ascending: false })
      .limit(1)
      .single();

    expect(inv).not.toBeNull();
    // 50% of 10000¢ = 5000¢
    expect(inv!.amount_in_cents).toBe(5000);
  });
});

/* ================================================================== */
/*  Zero fee — no invoice created                                     */
/* ================================================================== */

test.describe("No-show fee — zero percent", () => {
  let fixture: FixtureIds;
  let originalPolicies: Record<string, unknown> | null = null;

  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();

    await signInAs(page, TEST_EMAILS.client, "client");

    // 0% fee — tryEnforceFee returns early, no invoice should be created
    originalPolicies = await setPolicies({ noShowFeePercent: 0 });
    fixture = await seedBookingFixture();

    const ok = await signInAsAdmin(page);
    if (!ok) test.skip();
  });

  test.afterEach(async () => {
    if (fixture) await cleanBookingFixture(fixture);
    await restorePolicies(originalPolicies);
  });

  test("no fee charged when noShowFeePercent is 0", async ({ page }) => {
    const triggered = await triggerStatusChange(page, /^no.?show$/i);
    if (!triggered) return;

    await page.waitForTimeout(2000);

    const db = getAdminClient();
    const { data: invoiceRows } = await db
      .from("invoices")
      .select("id")
      .eq("client_id", fixture.clientId)
      .like("notes", `%booking #${fixture.bookingId}%`);

    // No invoice should have been created
    expect(invoiceRows).toHaveLength(0);
  });
});

/* ================================================================== */
/*  Late cancellation within window                                   */
/* ================================================================== */

test.describe("Late cancellation fee", () => {
  let fixture: FixtureIds;
  let originalPolicies: Record<string, unknown> | null = null;

  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();

    await signInAs(page, TEST_EMAILS.client, "client");

    // 24-hour window, 50% fee. Booking starts in 12 hours → inside window.
    originalPolicies = await setPolicies({
      cancelWindowHours: 24,
      lateCancelFeePercent: 50,
    });

    const twelveHoursMs = 12 * 60 * 60 * 1000;
    fixture = await seedBookingFixture(twelveHoursMs, 10000);

    const ok = await signInAsAdmin(page);
    if (!ok) test.skip();
  });

  test.afterEach(async () => {
    if (fixture) await cleanBookingFixture(fixture);
    await restorePolicies(originalPolicies);
  });

  test("cancellation within the window creates a late-cancellation fee invoice", async ({
    page,
  }) => {
    // Cancel the booking via the dropdown menu
    const triggered = await triggerStatusChange(page, /^cancel$/i);
    if (!triggered) return;

    // If a CancelDialog appears, confirm it
    const confirmBtn = page.locator("button", { hasText: /confirm cancel|yes, cancel/i }).first();
    if ((await confirmBtn.count()) > 0) {
      await confirmBtn.click();
    }

    await page.waitForTimeout(2000);

    const db = getAdminClient();
    const { data: inv } = await db
      .from("invoices")
      .select("id, amount_in_cents, description, status")
      .eq("client_id", fixture.clientId)
      .like("notes", `%booking #${fixture.bookingId}%`)
      .order("id", { ascending: false })
      .limit(1)
      .single();

    expect(inv).not.toBeNull();
    expect(inv!.status).toBe("sent");
    // 50% of 10000¢ = 5000¢
    expect(inv!.amount_in_cents).toBe(5000);
    expect(inv!.description).toMatch(/late cancel/i);
  });

  test("cancellation outside the window does not charge a fee", async ({ page }) => {
    // Re-seed a booking that starts in 48 hours — outside the 24h window
    await cleanBookingFixture(fixture);

    const fortyEightHoursMs = 48 * 60 * 60 * 1000 + 60_000;
    fixture = await seedBookingFixture(fortyEightHoursMs, 10000);

    // Reload page so the new booking appears
    const triggered = await triggerStatusChange(page, /^cancel$/i);
    if (!triggered) return;

    const confirmBtn = page.locator("button", { hasText: /confirm cancel|yes, cancel/i }).first();
    if ((await confirmBtn.count()) > 0) {
      await confirmBtn.click();
    }

    await page.waitForTimeout(2000);

    const db = getAdminClient();
    const { data: invoiceRows } = await db
      .from("invoices")
      .select("id")
      .eq("client_id", fixture.clientId)
      .like("notes", `%booking #${fixture.bookingId}%`);

    expect(invoiceRows).toHaveLength(0);
  });
});
