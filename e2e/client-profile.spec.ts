import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { hasAuthConfig, signInAsClient, TEST_EMAILS } from "./fixtures/auth";

/**
 * E2E tests for the client profile section at /dashboard/settings.
 *
 * ## Coverage
 * 1. Update name → button shows "Saved!" → refresh → new name persists.
 * 2. Update phone with valid E.164 → saved.
 * 3. Invalid phone "abc" → validation error.
 * 4. Update email → "Verification sent" banner.
 * 5. Birthday picker → set date and save.
 *
 * All tests sign in as the shared e2e client user and restore original
 * profile values in afterEach to keep the test user stable.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Reset profile fields to known defaults after each test. */
async function resetProfile() {
  const db = getAdminClient();
  const { data } = await db
    .from("profiles")
    .select("id")
    .eq("email", TEST_EMAILS.client)
    .limit(1)
    .single();
  if (!data) return;

  await db
    .from("profiles")
    .update({ first_name: "E2E", last_name: "Test", phone: null })
    .eq("id", data.id);

  await db
    .from("client_preferences")
    .upsert({ profile_id: data.id, birthday: null }, { onConflict: "profile_id" });
}

/** Navigate to settings and wait for the profile section to render. */
async function goToProfile(page: import("@playwright/test").Page) {
  await page.goto("/dashboard/settings");
  await page.waitForLoadState("networkidle");

  // Ensure the "My Profile" heading is visible
  await expect(page.getByText("My Profile")).toBeVisible();
}

test.describe("Client profile — authenticated", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();
    const ok = await signInAsClient(page);
    if (!ok) test.skip();
  });

  test.afterEach(async () => {
    if (hasAuthConfig()) await resetProfile();
  });

  // ── 1. Update name ─────────────────────────────────────────────────
  test("update name: save → Saved! → refresh → new name persists", async ({ page }) => {
    await goToProfile(page);

    const firstNameInput = page.getByLabel("First Name");
    const lastNameInput = page.getByLabel("Last Name");

    await firstNameInput.clear();
    await firstNameInput.fill("Alice");
    await lastNameInput.clear();
    await lastNameInput.fill("Wonder");

    const saveBtn = page.getByRole("button", { name: /save changes/i });
    await saveBtn.click();

    // Button text transitions to "Saved!"
    await expect(saveBtn).toContainText("Saved!");

    // Refresh and verify the name persisted
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.getByLabel("First Name")).toHaveValue("Alice");
    await expect(page.getByLabel("Last Name")).toHaveValue("Wonder");
  });

  // ── 2. Valid phone ─────────────────────────────────────────────────
  test("update phone with valid E.164 → saved", async ({ page }) => {
    await goToProfile(page);

    const phoneInput = page.getByLabel("Phone");
    await phoneInput.clear();
    await phoneInput.fill("+12125559999");

    const saveBtn = page.getByRole("button", { name: /save changes/i });
    await saveBtn.click();

    await expect(saveBtn).toContainText("Saved!");

    // No validation error visible
    await expect(page.locator("text=Phone must be a valid number")).not.toBeVisible();
  });

  // ── 3. Invalid phone ──────────────────────────────────────────────
  test("invalid phone 'abc' → validation error", async ({ page }) => {
    await goToProfile(page);

    const phoneInput = page.getByLabel("Phone");
    await phoneInput.clear();
    await phoneInput.fill("abc");

    const saveBtn = page.getByRole("button", { name: /save changes/i });
    await saveBtn.click();

    await expect(page.getByText("Phone must be a valid number")).toBeVisible({ timeout: 5000 });
  });

  // ── 4. Update email → verification banner ─────────────────────────
  test("update email shows verification sent message", async ({ page }) => {
    await goToProfile(page);

    const emailInput = page.getByLabel("Email");
    await emailInput.clear();
    await emailInput.fill("e2e-newemail@test.tcreativestudio.com");

    const saveBtn = page.getByRole("button", { name: /save changes/i });
    await saveBtn.click();

    // The confirmation banner appears with the pending email
    await expect(page.getByText(/confirmation link was sent/i)).toBeVisible({ timeout: 5000 });

    await expect(page.getByText("e2e-newemail@test.tcreativestudio.com")).toBeVisible();
  });

  // ── 5. Birthday picker ─────────────────────────────────────────────
  test("birthday picker: set date and save", async ({ page }) => {
    await goToProfile(page);

    const birthdayInput = page.getByLabel("Birthday");
    await birthdayInput.fill("1990-06-15");

    const saveBtn = page.getByRole("button", { name: /save changes/i });
    await saveBtn.click();

    await expect(saveBtn).toContainText("Saved!");

    // Refresh and verify the birthday persisted
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.getByLabel("Birthday")).toHaveValue("1990-06-15");
  });
});
