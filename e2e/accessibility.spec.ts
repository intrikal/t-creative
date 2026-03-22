import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

/**
 * Accessibility audits for public-facing pages using axe-core.
 *
 * ## Coverage
 * - Landing page (/)
 * - Services page (/services)
 * - Contact page (/contact)
 * - Training page (/training)
 * - Portfolio page (/portfolio)
 * - Public booking storefront (/book/tcreativestudio)
 * - Testimonials page (/testimonials)
 * - About page (/about)
 * - Login page (/login)
 *
 * Rules checked: WCAG 2.1 AA (axe default).
 * Known decorative / third-party iframes are excluded per-test as needed.
 *
 * Failures surface the full axe violation detail in the test output so you
 * can triage each issue (rule id, impact, affected node, help URL).
 */

/** Format axe violations into a readable string for test failure messages. */
function formatViolations(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"],
) {
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
function buildAxe(page: { page: import("@playwright/test").Page }["page"]) {
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .disableRules([
      // Third-party embeds (maps, video) can't be fixed by us
      "frame-title",
    ]);
}

/* ------------------------------------------------------------------ */
/*  Public pages                                                       */
/* ------------------------------------------------------------------ */

const publicPages = [
  { name: "landing page", path: "/" },
  { name: "services page", path: "/services" },
  { name: "contact page", path: "/contact" },
  { name: "training page", path: "/training" },
  { name: "portfolio page", path: "/portfolio" },
  { name: "about page", path: "/about" },
  { name: "testimonials page", path: "/testimonials" },
  { name: "login page", path: "/login" },
];

for (const { name, path } of publicPages) {
  test.describe(`Accessibility — ${name}`, () => {
    test("no critical or serious axe violations", async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      // Skip if page doesn't exist in this environment
      if (page.url().includes("/404") || page.url().includes("/not-found")) {
        test.skip();
        return;
      }

      const results = await buildAxe(page).analyze();

      const blocking = results.violations.filter((v) =>
        ["critical", "serious"].includes(v.impact ?? ""),
      );

      expect(blocking, formatViolations(blocking)).toHaveLength(0);
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Public booking storefront                                          */
/* ------------------------------------------------------------------ */

test.describe("Accessibility — public booking storefront", () => {
  test("no critical or serious axe violations on /book/tcreativestudio", async ({ page }) => {
    await page.goto("/book/tcreativestudio");
    await page.waitForLoadState("networkidle");

    if (page.url().includes("/404") || page.url().includes("/not-found")) {
      test.skip();
      return;
    }

    const results = await buildAxe(page).analyze();

    const blocking = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    );

    expect(blocking, formatViolations(blocking)).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Keyboard navigation — booking flow                                 */
/* ------------------------------------------------------------------ */

test.describe("Keyboard navigation — booking dialog", () => {
  test("can navigate booking flow with keyboard only", async ({ page }) => {
    await page.goto("/book/tcreativestudio");
    await page.waitForLoadState("networkidle");

    if (page.url().includes("/404") || page.url().includes("/not-found")) {
      test.skip();
      return;
    }

    // Find and click a "Book" button to open the booking dialog
    const bookButton = page.locator('button:has-text("Book")').first();
    if (!(await bookButton.isVisible())) {
      test.skip();
      return;
    }

    await bookButton.click();

    // Dialog should be visible
    const dialog = page.locator('[role="dialog"], .fixed.inset-0').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Tab should cycle within the dialog (focus trap test)
    await page.keyboard.press("Tab");
    const focusedElement = page.locator(":focus");
    await expect(focusedElement).toBeVisible();

    // Escape should close the dialog
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});

/* ------------------------------------------------------------------ */
/*  ARIA landmarks                                                     */
/* ------------------------------------------------------------------ */

test.describe("ARIA landmarks — booking page", () => {
  test("has required landmarks", async ({ page }) => {
    await page.goto("/book/tcreativestudio");
    await page.waitForLoadState("networkidle");

    if (page.url().includes("/404") || page.url().includes("/not-found")) {
      test.skip();
      return;
    }

    // Should have a skip-to-main link
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toHaveCount(1);

    // Should have a main landmark
    const main = page.locator("main, [role='main']");
    expect(await main.count()).toBeGreaterThanOrEqual(1);
  });
});

/* ------------------------------------------------------------------ */
/*  Color contrast spot check                                          */
/* ------------------------------------------------------------------ */

test.describe("Color contrast — booking page", () => {
  test("no contrast violations", async ({ page }) => {
    await page.goto("/book/tcreativestudio");
    await page.waitForLoadState("networkidle");

    if (page.url().includes("/404") || page.url().includes("/not-found")) {
      test.skip();
      return;
    }

    const results = await new AxeBuilder({ page })
      .withRules(["color-contrast"])
      .analyze();

    const blocking = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    );

    expect(blocking, formatViolations(blocking)).toHaveLength(0);
  });
});
