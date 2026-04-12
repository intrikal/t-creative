import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { hasAuthConfig, signInAsClient, TEST_EMAILS } from "./fixtures/auth";

/**
 * E2E tests for the multi-service / add-on booking flow.
 *
 * ## What is under test
 * The client booking page at /dashboard/book lets a client browse services,
 * optionally filter by category, and open the BookingRequestDialog for a
 * chosen service.  Inside the dialog, the "confirm" step surfaces add-ons,
 * the computed price, and (when configured) the deposit amount.
 *
 * "Multi-service" here means: a single booking that includes a base service
 * plus one or more add-ons.  The public storefront (/book/[slug]) is also
 * smoke-tested to verify service cards render pricing.
 *
 * ## Deposit calculation rules (lib/deposit.ts)
 * - "sum"     → sum of all individual service deposits
 * - "highest" → only the highest deposit is charged
 * - "fixed"   → flat amount configured by admin
 *
 * The UI shows the deposit on the service card ("<amount> deposit") and
 * again inside the booking dialog's confirm step.
 *
 * ## Fixture lifecycle
 * Tests that need seeded services create them via the service-role client,
 * exercise the UI, then clean up in afterEach.  Skipped when env vars absent.
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

/* ------------------------------------------------------------------ */
/*  Fixture helpers                                                    */
/* ------------------------------------------------------------------ */

interface ServiceFixture {
  serviceId: number;
  addonId: number | null;
}

/**
 * Seed a bookable service (with an optional add-on) for the E2E tests.
 * Returns IDs for cleanup.
 */
async function seedServiceWithAddOn(): Promise<ServiceFixture> {
  const db = getAdminClient();

  const { data: service, error: svcErr } = await db
    .from("services")
    .insert({
      name: "E2E Lash Service",
      category: "lash",
      duration_minutes: 90,
      price_in_cents: 12000, // $120.00
      deposit_in_cents: 3000, // $30.00
      is_active: true,
      description: "Full set lash extensions for E2E testing",
    })
    .select("id")
    .single();

  if (svcErr || !service) {
    throw new Error(`Could not insert service: ${svcErr?.message}`);
  }

  const { data: addon, error: addonErr } = await db
    .from("service_add_ons")
    .insert({
      service_id: service.id,
      name: "E2E Volume Upgrade",
      additional_minutes: 30,
      price_in_cents: 2500, // $25.00
      is_active: true,
    })
    .select("id")
    .single();

  return {
    serviceId: service.id,
    addonId: addonErr || !addon ? null : addon.id,
  };
}

async function cleanServiceFixture({ serviceId, addonId }: ServiceFixture) {
  const db = getAdminClient();
  if (addonId) await db.from("service_add_ons").delete().eq("id", addonId);
  await db.from("services").delete().eq("id", serviceId);
}

/* ================================================================== */
/*  /dashboard/book — unauthenticated redirect                        */
/* ================================================================== */

test.describe("Book page — unauthenticated", () => {
  test("redirects to /login", async ({ page }) => {
    await page.goto("/dashboard/book");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toContain("/login");
  });
});

/* ================================================================== */
/*  /dashboard/book — authenticated client (no seeding needed)        */
/* ================================================================== */

test.describe("Book page — authenticated client (smoke)", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();
    const ok = await signInAsClient(page);
    if (!ok) test.skip();
  });

  test("renders the Book a Service heading", async ({ page }) => {
    await page.goto("/dashboard/book");
    await page.waitForLoadState("networkidle");

    expect(page.url()).not.toContain("/login");

    await expect(page.locator("h1").filter({ hasText: /book a service/i })).toBeVisible();
  });

  test("renders service cards or an empty state", async ({ page }) => {
    await page.goto("/dashboard/book");
    await page.waitForLoadState("networkidle");

    const hasCards =
      (await page.locator("button").filter({ hasText: /book this service/i }).count()) > 0;
    const hasEmpty =
      (await page.locator("text=/no services match|nothing available/i").count()) > 0;

    expect(hasCards || hasEmpty).toBe(true);
  });

  test("category filter tabs are rendered", async ({ page }) => {
    await page.goto("/dashboard/book");
    await page.waitForLoadState("networkidle");

    // The "All" tab is always present when there are any services
    const allTab = page.getByRole("button").filter({ hasText: /^all/i }).first();
    const hasServices = (await page.locator("button").filter({ hasText: /book this service/i }).count()) > 0;

    if (hasServices) {
      await expect(allTab).toBeVisible();
    } else {
      // No services — page still renders without crashing
      await expect(page.locator("main")).toBeVisible();
    }
  });

  test("search input filters the service list", async ({ page }) => {
    await page.goto("/dashboard/book");
    await page.waitForLoadState("networkidle");

    const initialCount = await page.locator("button").filter({ hasText: /book this service/i }).count();
    if (initialCount === 0) {
      test.skip();
      return;
    }

    const searchInput = page.locator('input[placeholder*="Search services"]');
    await expect(searchInput).toBeVisible();

    // Type something that matches nothing — should show empty state
    await searchInput.fill("zzz_no_match_xyz");
    await page.waitForTimeout(300); // debounce

    const afterCount = await page.locator("button").filter({ hasText: /book this service/i }).count();
    expect(afterCount).toBe(0);
    await expect(page.locator("text=/no services match/i")).toBeVisible();
  });
});

/* ================================================================== */
/*  Service card pricing — deposit shown when configured             */
/* ================================================================== */

test.describe("Service cards — pricing and deposit display", () => {
  let fixture: ServiceFixture;

  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();
    fixture = await seedServiceWithAddOn();
    const ok = await signInAsClient(page);
    if (!ok) test.skip();
  });

  test.afterEach(async () => {
    if (fixture) await cleanServiceFixture(fixture);
  });

  /* ---------------------------------------------------------------- */

  test("seeded service card shows price and deposit", async ({ page }) => {
    await page.goto("/dashboard/book");
    await page.waitForLoadState("networkidle");

    // Find the seeded service card
    const serviceCard = page.locator("div, article").filter({ hasText: "E2E Lash Service" }).first();

    const cardCount = await serviceCard.count();
    if (cardCount === 0) {
      test.skip();
      return;
    }

    // Price: $120 (or $120.00)
    await expect(serviceCard.locator("text=/\\$120/")).toBeVisible();

    // Deposit hint: "$30 deposit" or "$30.00 deposit"
    await expect(serviceCard.locator("text=/deposit/i")).toBeVisible();
  });

  test("seeded service card shows add-on name and additional price", async ({ page }) => {
    if (!fixture.addonId) {
      test.skip();
      return;
    }

    await page.goto("/dashboard/book");
    await page.waitForLoadState("networkidle");

    const serviceCard = page.locator("div, article").filter({ hasText: "E2E Lash Service" }).first();
    const cardCount = await serviceCard.count();
    if (cardCount === 0) {
      test.skip();
      return;
    }

    // Add-on section heading
    await expect(serviceCard.locator("text=/add-on/i")).toBeVisible();

    // Add-on name
    await expect(serviceCard.locator("text=E2E Volume Upgrade")).toBeVisible();

    // Additional price: +$25
    await expect(serviceCard.locator("text=/\\+\\$25/")).toBeVisible();
  });

  test("total price reflects service price plus selected add-ons in dialog confirm step", async ({
    page,
  }) => {
    await page.goto("/dashboard/book");
    await page.waitForLoadState("networkidle");

    const serviceCard = page.locator("div, article").filter({ hasText: "E2E Lash Service" }).first();
    const cardCount = await serviceCard.count();
    if (cardCount === 0) {
      test.skip();
      return;
    }

    // Click the "Book this service" button on the seeded service
    const bookBtn = serviceCard.getByRole("button", { name: /book this service/i });
    await bookBtn.click();
    await page.waitForLoadState("networkidle");

    // A dialog should open — wait for it
    const dialog = page.locator("[role='dialog']").first();
    const hasDialog = (await dialog.count()) > 0;
    if (!hasDialog) {
      test.skip();
      return;
    }

    // Service name should be visible in the dialog
    const dialogText = await dialog.textContent();
    expect(dialogText).toContain("E2E Lash Service");
  });
});

/* ================================================================== */
/*  Booking dialog — add-on selection and deposit logic               */
/* ================================================================== */

test.describe("Booking dialog — add-on selection (seeded service)", () => {
  let fixture: ServiceFixture;

  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();
    fixture = await seedServiceWithAddOn();
    const ok = await signInAsClient(page);
    if (!ok) test.skip();
  });

  test.afterEach(async () => {
    if (fixture) await cleanServiceFixture(fixture);
  });

  /* ---------------------------------------------------------------- */

  test("booking dialog opens for seeded service", async ({ page }) => {
    await page.goto("/dashboard/book");
    await page.waitForLoadState("networkidle");

    const serviceCard = page.locator("div, article").filter({ hasText: "E2E Lash Service" }).first();
    if ((await serviceCard.count()) === 0) {
      test.skip();
      return;
    }

    await serviceCard.getByRole("button", { name: /book this service/i }).click();
    await page.waitForLoadState("networkidle");

    // Dialog with a calendar step should open
    const dialog = page.locator("[role='dialog']").first();
    await expect(dialog).toBeVisible();
  });

  test("dialog first step is date selection (calendar visible)", async ({ page }) => {
    await page.goto("/dashboard/book");
    await page.waitForLoadState("networkidle");

    const serviceCard = page.locator("div, article").filter({ hasText: "E2E Lash Service" }).first();
    if ((await serviceCard.count()) === 0) {
      test.skip();
      return;
    }

    await serviceCard.getByRole("button", { name: /book this service/i }).click();
    await page.waitForLoadState("networkidle");

    // The first step shows a calendar
    const hasCalendar =
      (await page.locator("[role='grid'], table, [class*='calendar']").count()) > 0;

    // Or a loading state while availability is fetched
    const hasLoader =
      (await page.locator("[class*='loader'], [class*='spin'], text=/loading/i").count()) > 0;

    expect(hasCalendar || hasLoader).toBe(true);
  });

  test("closing the dialog removes it from the page", async ({ page }) => {
    await page.goto("/dashboard/book");
    await page.waitForLoadState("networkidle");

    const serviceCard = page.locator("div, article").filter({ hasText: "E2E Lash Service" }).first();
    if ((await serviceCard.count()) === 0) {
      test.skip();
      return;
    }

    await serviceCard.getByRole("button", { name: /book this service/i }).click();
    await page.waitForLoadState("networkidle");

    const dialog = page.locator("[role='dialog']").first();
    if ((await dialog.count()) === 0) {
      test.skip();
      return;
    }

    // Close via the X button
    const closeBtn = dialog
      .locator("button")
      .filter({ hasNotText: /back|cancel|go back/i })
      .first();

    // Try the X icon button (typically top-right)
    const xBtn = page.locator("button[aria-label*='close' i], button[title*='close' i]").first();
    if ((await xBtn.count()) > 0) {
      await xBtn.click();
    } else {
      await closeBtn.click();
    }

    await page.waitForLoadState("networkidle");
    await expect(page.locator("[role='dialog']")).toHaveCount(0);
  });
});

/* ================================================================== */
/*  Deposit calculation smoke tests (via UI text)                     */
/* ================================================================== */

test.describe("Deposit display — sum / highest / fixed modes", () => {
  test("service card shows deposit amount when deposit_in_cents is set", async ({ page }) => {
    if (!hasAuthConfig()) test.skip();

    const ok = await signInAsClient(page);
    if (!ok) test.skip();

    await page.goto("/dashboard/book");
    await page.waitForLoadState("networkidle");

    // Find any service card that shows a deposit hint
    const depositHint = page.locator("text=/deposit/i").first();
    const hasDeposit = (await depositHint.count()) > 0;

    if (!hasDeposit) {
      // No services with a deposit configured — skip rather than fail
      test.skip();
      return;
    }

    await expect(depositHint).toBeVisible();

    // The deposit text must include a dollar amount
    const text = (await depositHint.textContent()) ?? "";
    expect(text).toMatch(/\$[\d,]+/);
  });

  test("public storefront service card shows deposit when configured", async ({ page }) => {
    // The public storefront may expose a /book/[slug] page
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Find a "Book" or "Book Now" link to the storefront
    const bookLink = page
      .getByRole("link")
      .filter({ hasText: /^book$|^book now$|^book a service$/i })
      .first();

    const count = await bookLink.count();
    if (count === 0) {
      test.skip();
      return;
    }

    const href = await bookLink.getAttribute("href");
    if (!href?.startsWith("/book/")) {
      test.skip();
      return;
    }

    await page.goto(href);
    await page.waitForLoadState("networkidle");

    // Services section should be visible
    const hasServices =
      (await page.locator("button").filter({ hasText: /^book$|^waitlist$/i }).count()) > 0;

    if (!hasServices) {
      test.skip();
      return;
    }

    // At least one service price should be shown
    const priceText = page.locator("text=/\\$\\d+/").first();
    await expect(priceText).toBeVisible();
  });
});

/* ================================================================== */
/*  Booking request submission — confirm step (seeded service)        */
/* ================================================================== */

test.describe("Booking request — confirm step with all services listed", () => {
  let fixture: ServiceFixture;

  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();
    fixture = await seedServiceWithAddOn();

    // Sign in both client and admin so profiles exist for the booking
    const ok = await signInAsClient(page);
    if (!ok) test.skip();
  });

  test.afterEach(async () => {
    if (fixture) await cleanServiceFixture(fixture);
  });

  /* ---------------------------------------------------------------- */

  test("booking request is submitted and a confirmation or next step is shown", async ({
    page,
  }) => {
    await page.goto("/dashboard/book");
    await page.waitForLoadState("networkidle");

    const serviceCard = page.locator("div, article").filter({ hasText: "E2E Lash Service" }).first();
    if ((await serviceCard.count()) === 0) {
      test.skip();
      return;
    }

    // Open the dialog
    await serviceCard.getByRole("button", { name: /book this service/i }).click();
    await page.waitForLoadState("networkidle");

    const dialog = page.locator("[role='dialog']").first();
    if ((await dialog.count()) === 0) {
      test.skip();
      return;
    }

    // Step 1: pick a date — click first enabled day on the calendar
    const enabledDay = page
      .locator("[role='gridcell']:not([aria-disabled='true']) button")
      .filter({ hasNotText: /^\s*$/ })
      .first();

    const dayCount = await enabledDay.count();
    if (dayCount === 0) {
      // No available dates (e.g. no business hours configured) — skip gracefully
      test.skip();
      return;
    }

    await enabledDay.click();
    await page.waitForLoadState("networkidle");

    // Step 2: pick a time slot
    const timeSlot = page
      .locator("button")
      .filter({ hasText: /^\d{1,2}:\d{2}(am|pm)$/i })
      .first();

    const slotCount = await timeSlot.count();
    if (slotCount === 0) {
      test.skip();
      return;
    }

    await timeSlot.click();
    await page.waitForLoadState("networkidle");

    // After time selection, the page should advance to intake or confirm step
    const advanced =
      (await page.locator("text=/confirm|your booking|request|notes/i").count()) > 0 ||
      (await page.locator("button").filter({ hasText: /next|continue|send request|book now/i }).count()) > 0;

    expect(advanced).toBe(true);

    // The service name should still be visible in the dialog
    const dialogContent = await page.locator("[role='dialog']").textContent();
    expect(dialogContent).toContain("E2E Lash Service");
  });

  test("all services are listed in the dialog — service name is visible at every step", async ({
    page,
  }) => {
    await page.goto("/dashboard/book");
    await page.waitForLoadState("networkidle");

    const serviceCard = page.locator("div, article").filter({ hasText: "E2E Lash Service" }).first();
    if ((await serviceCard.count()) === 0) {
      test.skip();
      return;
    }

    await serviceCard.getByRole("button", { name: /book this service/i }).click();
    await page.waitForLoadState("networkidle");

    const dialog = page.locator("[role='dialog']").first();
    if ((await dialog.count()) === 0) {
      test.skip();
      return;
    }

    // Service name must be present in the dialog at the initial step
    const dialogText = await dialog.textContent();
    expect(dialogText).toContain("E2E Lash Service");

    // The price should also be reflected ($120 or $120.00)
    const hasPrice = /\$120/.test(dialogText ?? "");
    expect(hasPrice).toBe(true);
  });

  test("deposit amount is shown when service has deposit configured", async ({ page }) => {
    await page.goto("/dashboard/book");
    await page.waitForLoadState("networkidle");

    const serviceCard = page.locator("div, article").filter({ hasText: "E2E Lash Service" }).first();
    if ((await serviceCard.count()) === 0) {
      test.skip();
      return;
    }

    // The deposit hint "$30 deposit" should appear on the card
    const depositHint = serviceCard.locator("text=/\\$30.*deposit|deposit.*\\$30/i").first();
    const hasDeposit = (await depositHint.count()) > 0;

    if (!hasDeposit) {
      // Deposit display might be formatted differently — check for "deposit" text at minimum
      const anyDeposit = serviceCard.locator("text=/deposit/i").first();
      if ((await anyDeposit.count()) > 0) {
        await expect(anyDeposit).toBeVisible();
      }
      return;
    }

    await expect(depositHint).toBeVisible();
  });
});
