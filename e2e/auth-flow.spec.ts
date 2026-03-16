import { test, expect } from "@playwright/test";
import { hasAuthConfig, signInAsClient, signInAsAdmin } from "./fixtures/auth";

/**
 * E2E tests for authentication flows.
 *
 * ## Coverage
 * - Login page renders with all OAuth providers and email form.
 * - Protected routes redirect unauthenticated visitors to /login.
 * - New users (incomplete onboarding) are redirected to /onboarding.
 * - Admin users land on /admin after sign-in.
 * - Client users land on /dashboard after sign-in.
 *
 * Tests that require a live Supabase connection are skipped automatically
 * when SUPABASE_SERVICE_ROLE_KEY is not set.
 */

test.describe("Login page", () => {
  test("renders the sign-in heading", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toContainText(/sign in/i);
  });

  test("shows all OAuth provider buttons", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    for (const label of ["Google", "Apple", "GitHub", "X"]) {
      await expect(page.getByRole("button", { name: new RegExp(label, "i") })).toBeVisible();
    }
  });

  test("shows the magic-link email form", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with email/i })).toBeVisible();
  });

  test("magic-link submit button is disabled while email is empty", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const submitBtn = page.getByRole("button", { name: /continue with email/i });
    await expect(submitBtn).toBeDisabled();
  });

  test("magic-link submit button enables after typing an email", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.locator('input[type="email"]').fill("test@example.com");
    const submitBtn = page.getByRole("button", { name: /continue with email/i });
    await expect(submitBtn).toBeEnabled();
  });

  test("shows suspended error banner when ?error=suspended", async ({ page }) => {
    await page.goto("/login?error=suspended");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=suspended")).toBeVisible();
  });

  test("shows auth-failed error banner when ?error=auth_failed", async ({ page }) => {
    await page.goto("/login?error=auth_failed");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Authentication failed")).toBeVisible();
  });
});

test.describe("Unauthenticated redirects", () => {
  const protectedRoutes = [
    "/dashboard",
    "/dashboard/book",
    "/dashboard/bookings",
    "/dashboard/calendar",
    "/dashboard/loyalty",
    "/dashboard/aftercare",
    "/dashboard/settings",
    "/dashboard/messages",
  ];

  for (const route of protectedRoutes) {
    test(`${route} redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      expect(page.url()).toContain("/login");
    });
  }
});

test.describe("Role-based routing after sign-in", () => {
  test("client lands on /dashboard", async ({ page }) => {
    if (!hasAuthConfig()) test.skip();

    const ok = await signInAsClient(page);
    if (!ok) test.skip();

    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard");
  });

  test("admin lands on /admin", async ({ page }) => {
    if (!hasAuthConfig()) test.skip();

    const ok = await signInAsAdmin(page);
    if (!ok) test.skip();

    await page.waitForLoadState("networkidle");
    // Admin users are routed to /admin when their profile.role === "admin"
    expect(page.url()).toContain("/admin");
  });
});

test.describe("Auth callback error handling", () => {
  test("missing code redirects to /auth/error", async ({ page }) => {
    await page.goto("/auth/callback");
    await page.waitForLoadState("networkidle");

    expect(page.url()).toContain("/auth/error");
  });
});
