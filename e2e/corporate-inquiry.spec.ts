import { test, expect } from "@playwright/test";

/**
 * E2E tests for the public-facing corporate event inquiry page (/events/corporate).
 *
 * Runs without authentication — no env vars required beyond a running dev server.
 *
 * ## Coverage
 * - Page loads with a visible heading.
 * - All required form fields are present and interactive.
 * - The submit button is present.
 */

test.describe("Corporate inquiry page (/events/corporate)", () => {
  test("loads and renders a heading", async ({ page }) => {
    await page.goto("/events/corporate");
    await page.waitForLoadState("networkidle");

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
  });

  test("renders the contact name field", async ({ page }) => {
    await page.goto("/events/corporate");
    await page.waitForLoadState("networkidle");

    const field = page.locator("input[name='contactName'], input[id='contactName']").first();
    await expect(field).toBeVisible();
  });

  test("renders the company name field", async ({ page }) => {
    await page.goto("/events/corporate");
    await page.waitForLoadState("networkidle");

    const field = page.locator("input[name='companyName'], input[id='companyName']").first();
    await expect(field).toBeVisible();
  });

  test("renders the email field", async ({ page }) => {
    await page.goto("/events/corporate");
    await page.waitForLoadState("networkidle");

    const field = page
      .locator("input[type='email'], input[name='email'], input[id='email']")
      .first();
    await expect(field).toBeVisible();
  });

  test("renders the headcount field", async ({ page }) => {
    await page.goto("/events/corporate");
    await page.waitForLoadState("networkidle");

    const field = page
      .locator("input[type='number'], input[name='headcount'], input[id='headcount']")
      .first();
    await expect(field).toBeVisible();
  });

  test("renders the event type selector", async ({ page }) => {
    await page.goto("/events/corporate");
    await page.waitForLoadState("networkidle");

    // Event type can be a <select> or a Radix-style combobox button
    const selector = page
      .locator("select[name='eventType'], [role='combobox'], [aria-label*='event type' i]")
      .first();
    await expect(selector).toBeVisible();
  });

  test("renders the services radio options", async ({ page }) => {
    await page.goto("/events/corporate");
    await page.waitForLoadState("networkidle");

    // At least one radio input for services must be present
    const radio = page.locator("input[type='radio']").first();
    await expect(radio).toBeVisible();
  });

  test("renders the details textarea", async ({ page }) => {
    await page.goto("/events/corporate");
    await page.waitForLoadState("networkidle");

    const textarea = page.locator("textarea").first();
    await expect(textarea).toBeVisible();
  });

  test("renders the submit button", async ({ page }) => {
    await page.goto("/events/corporate");
    await page.waitForLoadState("networkidle");

    const btn = page
      .getByRole("button")
      .filter({ hasText: /submit|send|request/i })
      .first();
    await expect(btn).toBeVisible();
  });

  test("contact name field accepts text input", async ({ page }) => {
    await page.goto("/events/corporate");
    await page.waitForLoadState("networkidle");

    const field = page.locator("input[name='contactName'], input[id='contactName']").first();
    await field.fill("Jane Smith");
    await expect(field).toHaveValue("Jane Smith");
  });

  test("company name field accepts text input", async ({ page }) => {
    await page.goto("/events/corporate");
    await page.waitForLoadState("networkidle");

    const field = page.locator("input[name='companyName'], input[id='companyName']").first();
    await field.fill("Acme Corp");
    await expect(field).toHaveValue("Acme Corp");
  });
});
