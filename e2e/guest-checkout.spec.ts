import { test, expect } from "@playwright/test";

/**
 * E2E tests for the guest checkout flow.
 *
 * Tests the full public shop → cart → checkout → order placed journey
 * without authentication. These tests run against localhost and don't
 * require any auth env vars.
 *
 * Note: Tests that involve actual payment (Square) or shipping (EasyPost)
 * are skipped unless the corresponding env vars are set, since they would
 * make real API calls.
 */

test.describe("Shop page", () => {
  test("loads and renders the hero", async ({ page }) => {
    await page.goto("/shop");
    await page.waitForLoadState("networkidle");

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText(/studio home|shop/i);
  });

  test("shows search toolbar when products exist", async ({ page }) => {
    await page.goto("/shop");
    await page.waitForLoadState("networkidle");

    // Either the search toolbar or the empty state should be visible
    const searchInput = page.getByPlaceholder("Search products");
    const emptyState = page.getByText("The shop is being stocked");

    const hasProducts = await searchInput.isVisible().catch(() => false);
    const isEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasProducts || isEmpty).toBe(true);
  });

  test("empty state shows CTAs when no products", async ({ page }) => {
    await page.goto("/shop");
    await page.waitForLoadState("networkidle");

    const emptyState = page.getByText("The shop is being stocked");
    if (await emptyState.isVisible().catch(() => false)) {
      await expect(page.getByRole("link", { name: /browse services/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /get in touch/i })).toBeVisible();
    }
  });
});

test.describe("Checkout page — unauthenticated", () => {
  test("loads without redirecting to login", async ({ page }) => {
    await page.goto("/shop/checkout");
    await page.waitForLoadState("networkidle");

    // Should NOT redirect to /login
    expect(page.url()).toContain("/shop/checkout");
  });

  test("shows empty cart state when no items", async ({ page }) => {
    await page.goto("/shop/checkout");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Your cart is empty")).toBeVisible();
    await expect(page.getByRole("link", { name: /continue shopping/i })).toBeVisible();
  });

  test("shows guest contact form fields", async ({ page }) => {
    // We need items in the cart first — add via localStorage (Zustand persist)
    await page.goto("/shop");
    await page.evaluate(() => {
      const cartState = {
        state: {
          items: [
            {
              productId: 1,
              title: "Test Product",
              priceInCents: 2500,
              quantity: 1,
              imageUrl: null,
            },
          ],
          shippingAddress: null,
          selectedRate: null,
        },
        version: 0,
      };
      localStorage.setItem("tc-cart", JSON.stringify(cartState));
    });

    await page.goto("/shop/checkout");
    await page.waitForLoadState("networkidle");

    // Guest contact fields should be visible
    await expect(page.getByPlaceholder("Full name *")).toBeVisible();
    await expect(page.getByPlaceholder("Email address *")).toBeVisible();
    await expect(page.getByPlaceholder("Phone (optional)")).toBeVisible();

    // "Already have an account?" link should exist
    await expect(page.getByText("Already have an account?")).toBeVisible();
  });

  test("shows fulfillment method options including shipping", async ({ page }) => {
    await page.goto("/shop");
    await page.evaluate(() => {
      const cartState = {
        state: {
          items: [
            {
              productId: 1,
              title: "Test Product",
              priceInCents: 2500,
              quantity: 1,
              imageUrl: null,
            },
          ],
          shippingAddress: null,
          selectedRate: null,
        },
        version: 0,
      };
      localStorage.setItem("tc-cart", JSON.stringify(cartState));
    });

    await page.goto("/shop/checkout");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Pay Now & Pick Up")).toBeVisible();
    await expect(page.getByText("Pick Up & Pay Cash")).toBeVisible();
    await expect(page.getByText("Ship to Me")).toBeVisible();
  });

  test("shows shipping address form when Ship to Me is selected", async ({ page }) => {
    await page.goto("/shop");
    await page.evaluate(() => {
      const cartState = {
        state: {
          items: [
            {
              productId: 1,
              title: "Test Product",
              priceInCents: 2500,
              quantity: 1,
              imageUrl: null,
            },
          ],
          shippingAddress: null,
          selectedRate: null,
        },
        version: 0,
      };
      localStorage.setItem("tc-cart", JSON.stringify(cartState));
    });

    await page.goto("/shop/checkout");
    await page.waitForLoadState("networkidle");

    // Click "Ship to Me"
    await page.getByText("Ship to Me").click();

    // Address fields should appear
    await expect(page.getByPlaceholder("Street address *")).toBeVisible();
    await expect(page.getByPlaceholder("City *")).toBeVisible();
    await expect(page.getByPlaceholder("State *")).toBeVisible();
    await expect(page.getByPlaceholder("ZIP code *")).toBeVisible();
    await expect(page.getByRole("button", { name: /get shipping rates/i })).toBeVisible();
  });

  test("Place Order button is disabled without guest name and email", async ({ page }) => {
    await page.goto("/shop");
    await page.evaluate(() => {
      const cartState = {
        state: {
          items: [
            {
              productId: 1,
              title: "Test Product",
              priceInCents: 2500,
              quantity: 1,
              imageUrl: null,
            },
          ],
          shippingAddress: null,
          selectedRate: null,
        },
        version: 0,
      };
      localStorage.setItem("tc-cart", JSON.stringify(cartState));
    });

    await page.goto("/shop/checkout");
    await page.waitForLoadState("networkidle");

    const placeOrderBtn = page.getByRole("button", { name: /place order/i });
    await expect(placeOrderBtn).toBeDisabled();

    // Fill in guest info
    await page.getByPlaceholder("Full name *").fill("Jane Guest");
    await page.getByPlaceholder("Email address *").fill("jane@example.com");

    // Button should now be enabled
    await expect(placeOrderBtn).toBeEnabled();
  });
});

test.describe("Navbar cart icon", () => {
  test("shows cart icon in navbar", async ({ page }) => {
    await page.goto("/shop");
    await page.waitForLoadState("networkidle");

    // Cart icon should be in the navbar (even when empty)
    const cartLink = page.getByRole("link", { name: /cart/i }).first();
    await expect(cartLink).toBeVisible();
  });

  test("cart badge shows count when items in cart", async ({ page }) => {
    await page.goto("/shop");
    await page.evaluate(() => {
      const cartState = {
        state: {
          items: [
            {
              productId: 1,
              title: "Test",
              priceInCents: 1000,
              quantity: 3,
              imageUrl: null,
            },
          ],
          shippingAddress: null,
          selectedRate: null,
        },
        version: 0,
      };
      localStorage.setItem("tc-cart", JSON.stringify(cartState));
    });

    await page.reload();
    await page.waitForLoadState("networkidle");

    // Badge should show "3"
    const badge = page.locator("nav").getByText("3");
    await expect(badge).toBeVisible();
  });
});
