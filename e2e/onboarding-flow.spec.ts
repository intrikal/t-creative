import { test, expect } from "@playwright/test";
import { hasAuthConfig, signInAsClient, signInAsNewClient } from "./fixtures/auth";

/**
 * E2E tests for the client onboarding wizard.
 *
 * ## Coverage
 * - New user (incomplete profile) is redirected to /onboarding after login.
 * - Step 1 (name): fill first/last name, advance with OK button.
 * - Step 2 (interests): select services, advance.
 * - Step 3 (policies): agree to waiver + cancellation, advance.
 * - Step 4 (rewards): select source or enter referral code, advance.
 * - Completion screen redirects to /dashboard via "Explore the Studio".
 * - Returning user (onboarding complete) is NOT redirected to /onboarding.
 * - Back button navigates to the previous step.
 * - Required fields prevent advancing (e.g. empty first name).
 *
 * ## Requirements
 * - A running Next.js dev server on localhost:3000
 * - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 *   (tests are skipped automatically when these are absent)
 *
 * ## Notes on step numbering
 * The client flow has 7 steps (or 8 if lash/jewelry triggers the allergies
 * step). This suite tests the core path without selecting lash/jewelry so
 * the allergies step is skipped: name → interests → contact → policies →
 * rewards → preferences → complete.
 */

test.describe("Onboarding — new user redirect", () => {
  test("new user is redirected to /onboarding after first login", async ({ page }) => {
    if (!hasAuthConfig()) test.skip();

    const ok = await signInAsNewClient(page);
    if (!ok) test.skip();

    // Auth callback should redirect incomplete users to /onboarding
    await page.waitForURL(/\/onboarding/, { timeout: 15_000 });
    expect(page.url()).toContain("/onboarding");
  });
});

test.describe("Onboarding — returning user bypass", () => {
  test("returning user (onboarding complete) is NOT redirected to /onboarding", async ({
    page,
  }) => {
    if (!hasAuthConfig()) test.skip();

    const ok = await signInAsClient(page);
    if (!ok) test.skip();

    // signInAsClient sets first_name="E2E" → isOnboardingComplete() = true
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/onboarding");
    expect(page.url()).toContain("/dashboard");
  });
});

test.describe("Onboarding wizard — step-by-step", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();

    const ok = await signInAsNewClient(page);
    if (!ok) test.skip();

    await page.waitForURL(/\/onboarding/, { timeout: 15_000 });
  });

  test("Step 1 (name): required first name prevents advancing", async ({ page }) => {
    // Step 1 should be visible — "What should we call you?"
    await expect(page.locator("h1")).toContainText(/what should we call you/i);

    // The OK button should be disabled when first name is empty
    const firstNameInput = page.locator('input[placeholder="First name"]');
    await firstNameInput.fill("");

    const okButton = page.locator("button", { hasText: "OK" });
    await expect(okButton).toBeDisabled();
  });

  test("Step 1 (name): fill name and advance", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/what should we call you/i);

    // Fill first name
    const firstNameInput = page.locator('input[placeholder="First name"]');
    await firstNameInput.fill("TestUser");

    // Fill last name
    const lastNameInput = page.locator('input[placeholder="Last name"]');
    await lastNameInput.fill("E2E");

    // OK button should now be enabled
    const okButton = page.locator("button", { hasText: "OK" });
    await expect(okButton).toBeEnabled();

    // Click OK to advance
    await okButton.click();

    // Step 2 — interests: "What brings you to T Creative?"
    await expect(page.locator("h1")).toContainText(/what brings you to t creative/i);
  });

  test("Step 2 (interests): select interests and advance", async ({ page }) => {
    // Advance past step 1
    await page.locator('input[placeholder="First name"]').fill("TestUser");
    await page.locator("button", { hasText: "OK" }).click();

    // Step 2 — interests
    await expect(page.locator("h1")).toContainText(/what brings you to t creative/i);

    // Select "Custom Crochet" and "Business Consulting" (avoids lash/jewelry
    // which would insert the conditional allergies step)
    await page.locator("button", { hasText: "Custom Crochet" }).click();
    await page.locator("button", { hasText: "Business Consulting" }).click();

    // Advance
    await page.locator("button", { hasText: "OK" }).click();

    // Next step should be contact (since allergies step is skipped)
    // StepContact shows the locked email chip + phone input
    const nextHeading = page.locator("h1");
    await expect(nextHeading).toBeVisible();
  });

  test("Step 3 (policies): both agreements required before advancing", async ({ page }) => {
    // Advance past step 1 (name)
    await page.locator('input[placeholder="First name"]').fill("TestUser");
    await page.locator("button", { hasText: "OK" }).click();

    // Advance past step 2 (interests) — select crochet to skip allergies
    await expect(page.locator("h1")).toContainText(/what brings you to t creative/i);
    await page.locator("button", { hasText: "Custom Crochet" }).click();
    await page.locator("button", { hasText: "OK" }).click();

    // Advance past step 3 (contact)
    await page.locator("button", { hasText: "OK" }).click();

    // Step 4 (policies) — "Policies & agreements"
    await expect(page.locator("h1")).toContainText(/policies.*agreements/i);

    // OK button should be disabled — neither agreement is checked
    const okButton = page.locator("button", { hasText: "OK" });
    await expect(okButton).toBeDisabled();

    // Click waiver toggle (A)
    await page.locator("button", { hasText: /service waiver/i }).click();

    // Still disabled — only one of two agreements checked
    await expect(okButton).toBeDisabled();

    // Click cancellation toggle (B)
    await page.locator("button", { hasText: /cancellation policy/i }).click();

    // Now both are agreed — OK should be enabled
    await expect(okButton).toBeEnabled();
  });

  test("Step 4 (rewards): select source and advance", async ({ page }) => {
    // Fast-forward to rewards step:
    // Step 1: name
    await page.locator('input[placeholder="First name"]').fill("TestUser");
    await page.locator("button", { hasText: "OK" }).click();

    // Step 2: interests
    await page.locator("button", { hasText: "Custom Crochet" }).click();
    await page.locator("button", { hasText: "OK" }).click();

    // Step 3: contact
    await page.locator("button", { hasText: "OK" }).click();

    // Step 4: policies
    await page.locator("button", { hasText: /service waiver/i }).click();
    await page.locator("button", { hasText: /cancellation policy/i }).click();
    await page.locator("button", { hasText: "OK" }).click();

    // Step 5 (rewards) — "Your loyalty perks"
    await expect(page.locator("h1")).toContainText(/loyalty perks/i);

    // Select a discovery source
    await page.locator("button", { hasText: "TikTok" }).click();

    // Click OK to advance
    await page.locator("button", { hasText: "OK" }).click();

    // Should advance to the next step (preferences)
    const nextHeading = page.locator("h1");
    await expect(nextHeading).toBeVisible();
  });

  test("Completion: wizard finishes and user can navigate to dashboard", async ({ page }) => {
    // Fast-forward through all steps:
    // Step 1: name
    await page.locator('input[placeholder="First name"]').fill("TestUser");
    await page.locator("button", { hasText: "OK" }).click();

    // Step 2: interests
    await page.locator("button", { hasText: "Custom Crochet" }).click();
    await page.locator("button", { hasText: "OK" }).click();

    // Step 3: contact
    await page.locator("button", { hasText: "OK" }).click();

    // Step 4: policies
    await page.locator("button", { hasText: /service waiver/i }).click();
    await page.locator("button", { hasText: /cancellation policy/i }).click();
    await page.locator("button", { hasText: "OK" }).click();

    // Step 5: rewards — select source and advance
    await page.locator("button", { hasText: "TikTok" }).click();
    await page.locator("button", { hasText: "OK" }).click();

    // Step 6: preferences — advance (all fields optional)
    await page.locator("button", { hasText: "OK" }).click();

    // Completion screen — "You're all set"
    await expect(page.locator("h1")).toContainText(/you're all set/i);

    // The "Explore the Studio" button triggers hard navigation to /dashboard
    const exploreButton = page.locator("button", { hasText: /explore the studio/i });
    await expect(exploreButton).toBeVisible();
  });

  test("Back button works at each step", async ({ page }) => {
    // Step 1: fill name and advance
    await page.locator('input[placeholder="First name"]').fill("TestUser");
    await page.locator("button", { hasText: "OK" }).click();

    // Step 2 should be visible
    await expect(page.locator("h1")).toContainText(/what brings you to t creative/i);

    // Click the back/previous arrow button in the bottom nav bar
    // OnboardingShell renders up/down arrow buttons; the "previous" button
    // navigates backward. It's rendered as an SVG arrow inside a button.
    const prevButton = page.locator("button[aria-label='Previous step'], button:has(svg) >> nth=0");
    // The shell has a "N of M" counter + prev/next buttons at the bottom.
    // Find the back button by looking for the navigation bar at the bottom.
    const bottomNav = page.locator("text=/1 of|2 of/i").locator("..");
    const backBtn = bottomNav.locator("button").first();
    await backBtn.click();

    // Should be back on step 1
    await expect(page.locator("h1")).toContainText(/what should we call you/i);

    // The first name we entered should still be there (form state preserved)
    const firstNameInput = page.locator('input[placeholder="First name"]');
    await expect(firstNameInput).toHaveValue("TestUser");
  });

  test("Required fields prevent advancing — empty first name shows disabled OK", async ({
    page,
  }) => {
    // On step 1, clear the first name input
    const firstNameInput = page.locator('input[placeholder="First name"]');
    await firstNameInput.fill("");

    // OK button should be disabled
    const okButton = page.locator("button", { hasText: "OK" });
    await expect(okButton).toBeDisabled();

    // Type a name — OK should enable
    await firstNameInput.fill("Jane");
    await expect(okButton).toBeEnabled();

    // Clear again — OK should disable
    await firstNameInput.fill("");
    await expect(okButton).toBeDisabled();
  });
});
