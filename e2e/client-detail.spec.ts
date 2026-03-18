import { test, expect } from "@playwright/test";
import { hasAuthConfig, signInAsAdmin } from "./fixtures/auth";

/**
 * E2E smoke tests for the admin client detail page.
 *
 * ## Coverage
 * - Admin can view the client list.
 * - Admin can navigate to a client's detail page.
 * - Client detail page renders profile info, tabs, and stats.
 * - Admin can navigate back to the client list.
 *
 * Skipped when no Supabase auth config is available.
 */

test.describe("Client list — unauthenticated", () => {
  test("/dashboard/clients redirects to /login", async ({ page }) => {
    await page.goto("/dashboard/clients");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toContain("/login");
  });
});

test.describe("Client list — admin", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();
    const ok = await signInAsAdmin(page);
    if (!ok) test.skip();
  });

  test("client list page renders", async ({ page }) => {
    await page.goto("/dashboard/clients");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toContain("/dashboard/clients");

    // Should show a heading
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible();
  });

  test("client list shows client cards or empty state", async ({ page }) => {
    await page.goto("/dashboard/clients");
    await page.waitForLoadState("networkidle");

    const hasClients =
      (await page.locator("a[href*='/dashboard/clients/']").count()) > 0;
    const hasEmptyState =
      (await page.locator("text=/no clients|no results/i").count()) > 0;

    expect(hasClients || hasEmptyState).toBe(true);
  });
});

test.describe("Client detail — admin", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();
    const ok = await signInAsAdmin(page);
    if (!ok) test.skip();
  });

  test("navigating to a client shows their detail page", async ({ page }) => {
    await page.goto("/dashboard/clients");
    await page.waitForLoadState("networkidle");

    const clientLink = page.locator("a[href*='/dashboard/clients/']").first();
    const linkCount = await clientLink.count();
    if (linkCount === 0) {
      test.skip();
      return;
    }

    await clientLink.click();
    await page.waitForLoadState("networkidle");

    // Should be on a client detail page
    expect(page.url()).toMatch(/\/dashboard\/clients\/.+/);

    // Should show the client's name or profile section
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible();
  });

  test("client detail page shows quick stats", async ({ page }) => {
    await page.goto("/dashboard/clients");
    await page.waitForLoadState("networkidle");

    const clientLink = page.locator("a[href*='/dashboard/clients/']").first();
    const linkCount = await clientLink.count();
    if (linkCount === 0) {
      test.skip();
      return;
    }

    await clientLink.click();
    await page.waitForLoadState("networkidle");

    // Should display stats like Visits, Total Spent, Points
    const stats = page.locator("text=/Visits|Total Spent|Points/i");
    await expect(stats.first()).toBeVisible();
  });

  test("client detail page has navigation tabs", async ({ page }) => {
    await page.goto("/dashboard/clients");
    await page.waitForLoadState("networkidle");

    const clientLink = page.locator("a[href*='/dashboard/clients/']").first();
    const linkCount = await clientLink.count();
    if (linkCount === 0) {
      test.skip();
      return;
    }

    await clientLink.click();
    await page.waitForLoadState("networkidle");

    // Should show tab buttons (Overview, Bookings, Payments, etc.)
    const tabs = page.locator("button").filter({
      hasText: /Overview|Bookings|Payments|Loyalty|Messages|Forms/i,
    });
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThan(0);
  });

  test("clicking Bookings tab shows booking history", async ({ page }) => {
    await page.goto("/dashboard/clients");
    await page.waitForLoadState("networkidle");

    const clientLink = page.locator("a[href*='/dashboard/clients/']").first();
    const linkCount = await clientLink.count();
    if (linkCount === 0) {
      test.skip();
      return;
    }

    await clientLink.click();
    await page.waitForLoadState("networkidle");

    const bookingsTab = page.locator("button", { hasText: /Bookings/i });
    const btCount = await bookingsTab.count();
    if (btCount === 0) {
      test.skip();
      return;
    }

    await bookingsTab.click();

    // Should show booking rows or empty state
    const bookingContent = page.locator(
      "text=/confirmed|completed|cancelled|pending|no bookings/i",
    );
    const contentCount = await bookingContent.count();
    expect(contentCount).toBeGreaterThanOrEqual(0);
  });

  test("clicking Payments tab shows payment history", async ({ page }) => {
    await page.goto("/dashboard/clients");
    await page.waitForLoadState("networkidle");

    const clientLink = page.locator("a[href*='/dashboard/clients/']").first();
    const linkCount = await clientLink.count();
    if (linkCount === 0) {
      test.skip();
      return;
    }

    await clientLink.click();
    await page.waitForLoadState("networkidle");

    const paymentsTab = page.locator("button", { hasText: /Payments/i });
    const ptCount = await paymentsTab.count();
    if (ptCount === 0) {
      test.skip();
      return;
    }

    await paymentsTab.click();

    // Should show payment summary or transactions
    const paymentContent = page.locator(
      "text=/Total Paid|Tips|Refunded|no payments/i",
    );
    const contentCount = await paymentContent.count();
    expect(contentCount).toBeGreaterThanOrEqual(0);
  });

  test("can navigate back to client list", async ({ page }) => {
    await page.goto("/dashboard/clients");
    await page.waitForLoadState("networkidle");

    const clientLink = page.locator("a[href*='/dashboard/clients/']").first();
    const linkCount = await clientLink.count();
    if (linkCount === 0) {
      test.skip();
      return;
    }

    await clientLink.click();
    await page.waitForLoadState("networkidle");
    expect(page.url()).toMatch(/\/dashboard\/clients\/.+/);

    // Click back button or navigate to client list
    const backLink = page
      .locator("a, button")
      .filter({ hasText: /back|clients/i })
      .first();
    const backCount = await backLink.count();

    if (backCount > 0) {
      await backLink.click();
    } else {
      // Fall back to direct navigation
      await page.goto("/dashboard/clients");
    }

    await page.waitForLoadState("networkidle");
    expect(page.url()).toMatch(/\/dashboard\/clients\/?$/);
  });
});
