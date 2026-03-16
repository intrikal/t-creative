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
 *
 * Rules checked: WCAG 2.1 AA (axe default).
 * Known decorative / third-party iframes are excluded per-test as needed.
 *
 * Failures surface the full axe violation detail in the test output so you
 * can triage each issue (rule id, impact, affected node, help URL).
 */

/** Format axe violations into a readable string for test failure messages. */
function formatViolations(
  violations: AxeBuilder["analyze"] extends () => Promise<infer R> ? R["violations"] : never,
) {
  return violations
    .map(
      (v) =>
        `[${v.impact?.toUpperCase() ?? "?"}] ${v.id}: ${v.description}\n` +
        v.nodes.map((n) => `  → ${n.target.join(", ")}`).join("\n"),
    )
    .join("\n\n");
}

test.describe("Accessibility — landing page", () => {
  test("no critical or serious axe violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .disableRules([
        // Third-party embeds (maps, video) can't be fixed by us
        "frame-title",
      ])
      .analyze();

    const blocking = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    );

    expect(blocking, formatViolations(blocking)).toHaveLength(0);
  });
});

test.describe("Accessibility — services page", () => {
  test("no critical or serious axe violations", async ({ page }) => {
    await page.goto("/services");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const blocking = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    );

    expect(blocking, formatViolations(blocking)).toHaveLength(0);
  });
});

test.describe("Accessibility — contact page", () => {
  test("no critical or serious axe violations", async ({ page }) => {
    await page.goto("/contact");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const blocking = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    );

    expect(blocking, formatViolations(blocking)).toHaveLength(0);
  });
});

test.describe("Accessibility — training page", () => {
  test("no critical or serious axe violations", async ({ page }) => {
    await page.goto("/training");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const blocking = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    );

    expect(blocking, formatViolations(blocking)).toHaveLength(0);
  });
});

test.describe("Accessibility — portfolio page", () => {
  test("no critical or serious axe violations", async ({ page }) => {
    await page.goto("/portfolio");
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const blocking = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    );

    expect(blocking, formatViolations(blocking)).toHaveLength(0);
  });
});

test.describe("Accessibility — public booking storefront", () => {
  test("no critical or serious axe violations on /book/tcreativestudio", async ({ page }) => {
    await page.goto("/book/tcreativestudio");
    await page.waitForLoadState("networkidle");

    // Skip gracefully if the slug doesn't exist in this environment
    if (page.url().includes("/404") || page.url().includes("/not-found")) {
      test.skip();
      return;
    }

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const blocking = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    );

    expect(blocking, formatViolations(blocking)).toHaveLength(0);
  });
});
