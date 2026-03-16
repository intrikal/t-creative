import { test, expect } from "@playwright/test";
import { hasAuthConfig, signInAsClient } from "./fixtures/auth";

/**
 * E2E tests for the client-facing dashboard.
 *
 * ## Coverage
 * - /dashboard redirects unauthenticated visitors to /login.
 * - Client sees the home view with booking and loyalty sections.
 * - /dashboard/loyalty loads loyalty points and tier info.
 * - /dashboard/aftercare loads aftercare guidance.
 * - /dashboard/settings loads client-specific settings.
 * - /dashboard/bookings shows the client's booking history.
 *
 * Authenticated tests are skipped when SUPABASE_SERVICE_ROLE_KEY is absent.
 */

test.describe("Client dashboard — unauthenticated", () => {
  test("/dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toContain("/login");
  });

  test("/dashboard/loyalty redirects to /login", async ({ page }) => {
    await page.goto("/dashboard/loyalty");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toContain("/login");
  });

  test("/dashboard/aftercare redirects to /login", async ({ page }) => {
    await page.goto("/dashboard/aftercare");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toContain("/login");
  });

  test("/dashboard/settings redirects to /login", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toContain("/login");
  });

  test("/dashboard/bookings redirects to /login", async ({ page }) => {
    await page.goto("/dashboard/bookings");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toContain("/login");
  });
});

test.describe("Client home — authenticated", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();
    const ok = await signInAsClient(page);
    if (!ok) test.skip();
  });

  test("dashboard renders a greeting or heading", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    expect(page.url()).not.toContain("/login");
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible();
  });

  test("dashboard shows an upcoming bookings section", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // ClientHomePage renders upcoming bookings — either a list or an empty state
    const bookingSection = page.locator("text=/upcoming|your appointments|no upcoming|book your/i");
    await expect(bookingSection.first()).toBeVisible();
  });

  test("dashboard shows a loyalty points indicator", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // ClientHomePage renders loyalty points
    const loyaltySection = page.locator("text=/points|loyalty|rewards/i");
    await expect(loyaltySection.first()).toBeVisible();
  });
});

test.describe("Loyalty page — authenticated", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();
    const ok = await signInAsClient(page);
    if (!ok) test.skip();
  });

  test("loyalty page loads without error", async ({ page }) => {
    await page.goto("/dashboard/loyalty");
    await page.waitForLoadState("networkidle");

    expect(page.url()).not.toContain("/login");
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible();
  });

  test("loyalty page renders tier or points info", async ({ page }) => {
    await page.goto("/dashboard/loyalty");
    await page.waitForLoadState("networkidle");

    const loyaltyContent = page.locator("text=/points|tier|rewards|referral/i");
    await expect(loyaltyContent.first()).toBeVisible();
  });
});

test.describe("Aftercare page — authenticated", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();
    const ok = await signInAsClient(page);
    if (!ok) test.skip();
  });

  test("aftercare page loads and renders guidance content", async ({ page }) => {
    await page.goto("/dashboard/aftercare");
    await page.waitForLoadState("networkidle");

    expect(page.url()).not.toContain("/login");
    const main = page.locator("main, [role='main']").first();
    await expect(main).toBeVisible();
  });
});

test.describe("Client settings — authenticated", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();
    const ok = await signInAsClient(page);
    if (!ok) test.skip();
  });

  test("settings page loads the client settings form", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");

    expect(page.url()).not.toContain("/login");
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible();
  });

  test("settings page renders notification preferences", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");

    // ClientSettingsPage includes notification toggle controls
    const notifSection = page.locator("text=/notification|sms|email|reminder/i");
    await expect(notifSection.first()).toBeVisible();
  });
});

test.describe("Client bookings — authenticated", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();
    const ok = await signInAsClient(page);
    if (!ok) test.skip();
  });

  test("bookings page loads", async ({ page }) => {
    await page.goto("/dashboard/bookings");
    await page.waitForLoadState("networkidle");

    expect(page.url()).not.toContain("/login");
    expect(page.url()).toContain("/bookings");
  });

  test("bookings page renders booking history or empty state", async ({ page }) => {
    await page.goto("/dashboard/bookings");
    await page.waitForLoadState("networkidle");

    // Either a list of past/upcoming bookings or an empty-state message
    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible();
    const text = await mainContent.textContent();
    expect(text).toBeTruthy();
  });
});
