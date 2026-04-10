/**
 * Accessibility audits for authenticated dashboard pages using axe-core.
 *
 * ## Coverage
 * Tests the most important dashboard pages for each role (admin, client,
 * assistant) against WCAG 2.1 AA using the same axe configuration as
 * `accessibility.spec.ts`.
 *
 * ## Auth
 * Uses the Supabase-based auth fixtures from `e2e/fixtures/auth.ts`.
 * All tests are skipped when SUPABASE_SERVICE_ROLE_KEY is not set.
 *
 * ## Failure policy
 * Only critical and serious violations fail the test — minor / moderate
 * issues are logged but don't block CI.
 */

import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { hasAuthConfig, signInAsAdmin, signInAsAssistant, signInAsClient } from "./fixtures/auth";

/* ------------------------------------------------------------------ */
/*  Shared helpers (mirror accessibility.spec.ts)                      */
/* ------------------------------------------------------------------ */

/** Format axe violations into a readable string for test failure messages. */
function formatViolations(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) {
  return violations
    .map(
      (v) =>
        `[${v.impact?.toUpperCase() ?? "?"}] ${v.id}: ${v.description}\n` +
        `  Help: ${v.helpUrl}\n` +
        v.nodes.map((n) => `  → ${n.target.join(", ")}\n    ${n.failureSummary}`).join("\n"),
    )
    .join("\n\n");
}

/** Shared axe configuration for WCAG 2.1 AA compliance. */
function buildAxe(page: import("@playwright/test").Page) {
  return new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).disableRules([
    // Third-party embeds (maps, video) can't be fixed by us
    "frame-title",
  ]);
}

/**
 * Run an axe audit on the current page and assert no critical/serious
 * violations exist.
 */
async function assertNoBlockingViolations(page: import("@playwright/test").Page) {
  const results = await buildAxe(page).analyze();

  const blocking = results.violations.filter((v) =>
    ["critical", "serious"].includes(v.impact ?? ""),
  );

  expect(blocking, formatViolations(blocking)).toHaveLength(0);
}

/* ------------------------------------------------------------------ */
/*  Page definitions per role                                          */
/* ------------------------------------------------------------------ */

const adminPages = [
  { name: "admin home", path: "/dashboard" },
  { name: "bookings", path: "/dashboard/bookings" },
  { name: "clients", path: "/dashboard/clients" },
  { name: "services", path: "/dashboard/services" },
  { name: "financial", path: "/dashboard/financial" },
  { name: "settings", path: "/dashboard/settings" },
];

const clientPages = [
  { name: "client home", path: "/dashboard" },
  { name: "bookings", path: "/dashboard/bookings" },
  { name: "loyalty", path: "/dashboard/loyalty" },
  { name: "messages", path: "/dashboard/messages" },
  { name: "settings", path: "/dashboard/settings" },
];

const assistantPages = [
  { name: "assistant home", path: "/dashboard" },
  { name: "earnings", path: "/dashboard/earnings" },
  { name: "schedule", path: "/dashboard/schedule" },
];

/* ------------------------------------------------------------------ */
/*  Admin role                                                         */
/* ------------------------------------------------------------------ */

test.describe("Dashboard accessibility — admin", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();
    const ok = await signInAsAdmin(page);
    if (!ok) test.skip();
  });

  for (const { name, path } of adminPages) {
    test(`${name} (${path}) has no critical/serious axe violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // Skip if redirected to login (auth issue) or 404
      if (page.url().includes("/login") || page.url().includes("/not-found")) {
        test.skip();
        return;
      }

      // Wait for main content to render
      await expect(page.locator("main, [role='main']").first()).toBeVisible({ timeout: 10_000 });

      await assertNoBlockingViolations(page);
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Client role                                                        */
/* ------------------------------------------------------------------ */

test.describe("Dashboard accessibility — client", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();
    const ok = await signInAsClient(page);
    if (!ok) test.skip();
  });

  for (const { name, path } of clientPages) {
    test(`${name} (${path}) has no critical/serious axe violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      if (page.url().includes("/login") || page.url().includes("/not-found")) {
        test.skip();
        return;
      }

      await expect(page.locator("main, [role='main']").first()).toBeVisible({ timeout: 10_000 });

      await assertNoBlockingViolations(page);
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Assistant role                                                     */
/* ------------------------------------------------------------------ */

test.describe("Dashboard accessibility — assistant", () => {
  test.beforeEach(async ({ page }) => {
    if (!hasAuthConfig()) test.skip();
    const ok = await signInAsAssistant(page);
    if (!ok) test.skip();
  });

  for (const { name, path } of assistantPages) {
    test(`${name} (${path}) has no critical/serious axe violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      if (page.url().includes("/login") || page.url().includes("/not-found")) {
        test.skip();
        return;
      }

      await expect(page.locator("main, [role='main']").first()).toBeVisible({ timeout: 10_000 });

      await assertNoBlockingViolations(page);
    });
  }
});
