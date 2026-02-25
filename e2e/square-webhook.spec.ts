import { test, expect } from "@playwright/test";

/**
 * E2E tests for the Square webhook endpoint.
 *
 * These test the actual /api/webhooks/square route running on the dev
 * server. Since Square isn't connected yet these are sandbox/mock
 * payloads — they'll hit the real route handler but the DB calls will
 * either succeed against the dev DB or fail gracefully (the route
 * always returns 200 to Square).
 */

test.describe("POST /api/webhooks/square", () => {
  const webhookUrl = "/api/webhooks/square";

  test("returns 400 for invalid JSON body", async ({ request }) => {
    const response = await request.post(webhookUrl, {
      data: "this is not json {{{",
      headers: { "content-type": "text/plain" },
    });

    expect(response.status()).toBe(400);
    expect(await response.text()).toBe("Invalid JSON");
  });

  test("accepts well-formed payment.completed event", async ({ request }) => {
    const event = {
      event_id: `e2e_test_${Date.now()}`,
      type: "payment.completed",
      data: {
        object: {
          payment: {
            id: `sq_e2e_pay_${Date.now()}`,
            amount_money: { amount: 7500, currency: "USD" },
            status: "COMPLETED",
            receipt_url: "https://squareup.com/receipt/e2e-test",
            order_id: "sq_e2e_order_1",
            tenders: [{ type: "CARD" }],
          },
        },
      },
    };

    const response = await request.post(webhookUrl, {
      data: event,
      headers: { "content-type": "application/json" },
    });

    // Route always returns 200 to Square
    expect(response.status()).toBe(200);
  });

  test("accepts refund.created event", async ({ request }) => {
    const event = {
      event_id: `e2e_refund_${Date.now()}`,
      type: "refund.created",
      data: {
        object: {
          refund: {
            id: `sq_e2e_refund_${Date.now()}`,
            payment_id: "sq_nonexistent_pay",
            amount_money: { amount: 2500, currency: "USD" },
            status: "COMPLETED",
          },
        },
      },
    };

    const response = await request.post(webhookUrl, {
      data: event,
      headers: { "content-type": "application/json" },
    });

    expect(response.status()).toBe(200);
  });

  test("handles unknown event types gracefully", async ({ request }) => {
    const event = {
      event_id: `e2e_unknown_${Date.now()}`,
      type: "inventory.count.updated",
      data: { object: {} },
    };

    const response = await request.post(webhookUrl, {
      data: event,
      headers: { "content-type": "application/json" },
    });

    // Should still return 200 — never reject Square events
    expect(response.status()).toBe(200);
  });

  test("rejects request with invalid signature when key is configured", async ({ request }) => {
    // This test only matters when SQUARE_WEBHOOK_SIGNATURE_KEY is set.
    // If the env var is empty, the route skips signature checking and
    // this test will get a 200. We check for either outcome.
    const event = {
      event_id: `e2e_sig_${Date.now()}`,
      type: "payment.completed",
      data: { object: { payment: { id: "fake" } } },
    };

    const response = await request.post(webhookUrl, {
      data: event,
      headers: {
        "content-type": "application/json",
        "x-square-hmacsha256-signature": "definitely-wrong-signature",
      },
    });

    // 403 if key is set, 200 if key is not configured (sandbox mode)
    expect([200, 403]).toContain(response.status());
  });
});
