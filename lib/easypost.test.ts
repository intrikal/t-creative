import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockShipmentCreate = vi.fn();
const mockShipmentBuy = vi.fn();

function setupEasyPostMock() {
  vi.doMock("@easypost/api", () => {
    const Client = vi.fn().mockImplementation(function (this: any) {
      this.Shipment = {
        create: mockShipmentCreate,
        buy: mockShipmentBuy,
      };
    });
    return { default: Client };
  });
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
  vi.doMock("@/db/schema", () => ({}));
}

describe("easypost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe("isEasyPostConfigured", () => {
    it("returns false when EASYPOST_API_KEY is not set", async () => {
      vi.stubEnv("EASYPOST_API_KEY", "");
      setupEasyPostMock();
      const mod = await import("./easypost");
      expect(mod.isEasyPostConfigured()).toBe(false);
    });

    it("returns true when EASYPOST_API_KEY is set", async () => {
      vi.stubEnv("EASYPOST_API_KEY", "test_key_123");
      setupEasyPostMock();
      const mod = await import("./easypost");
      expect(mod.isEasyPostConfigured()).toBe(true);
    });
  });

  describe("getShippingRates", () => {
    it("creates shipment and returns sorted rates", async () => {
      vi.stubEnv("EASYPOST_API_KEY", "test_key_123");
      setupEasyPostMock();

      mockShipmentCreate.mockResolvedValue({
        id: "shp_123",
        rates: [
          { id: "rate_2", carrier: "USPS", service: "Priority", rate: "8.50", delivery_days: 3 },
          { id: "rate_1", carrier: "USPS", service: "Ground", rate: "5.25", delivery_days: 5 },
        ],
      });

      const mod = await import("./easypost");
      const result = await mod.getShippingRates({
        name: "Jane Doe",
        street1: "123 Main St",
        city: "Austin",
        state: "TX",
        zip: "78701",
        country: "US",
      });

      expect(result.shipmentId).toBe("shp_123");
      expect(result.rates).toHaveLength(2);
      // Sorted by price ascending
      expect(result.rates[0].rateInCents).toBe(525);
      expect(result.rates[1].rateInCents).toBe(850);
      expect(result.rates[0].carrier).toBe("USPS");
      expect(result.rates[0].estimatedDays).toBe(5);
    });

    it("throws when EasyPost is not configured", async () => {
      vi.stubEnv("EASYPOST_API_KEY", "");
      setupEasyPostMock();
      const mod = await import("./easypost");
      await expect(
        mod.getShippingRates({
          name: "Test",
          street1: "123 Main",
          city: "Austin",
          state: "TX",
          zip: "78701",
          country: "US",
        }),
      ).rejects.toThrow("EasyPost is not configured");
    });
  });

  describe("buyShippingLabel", () => {
    it("returns tracking URL and label info", async () => {
      vi.stubEnv("EASYPOST_API_KEY", "test_key_123");
      setupEasyPostMock();

      mockShipmentBuy.mockResolvedValue({
        tracker: { tracking_code: "TRACK123", public_url: "https://track.me/123" },
        tracking_code: "TRACK123",
        postage_label: { label_url: "https://label.me/123.pdf" },
        selected_rate: { carrier: "USPS", service: "Priority" },
      });

      const mod = await import("./easypost");
      const result = await mod.buyShippingLabel("shp_123", "rate_1");

      expect(result.trackingNumber).toBe("TRACK123");
      expect(result.trackingUrl).toBe("https://track.me/123");
      expect(result.labelUrl).toBe("https://label.me/123.pdf");
      expect(result.carrier).toBe("USPS");
      expect(result.service).toBe("Priority");
    });

    it("throws when EasyPost is not configured", async () => {
      vi.stubEnv("EASYPOST_API_KEY", "");
      setupEasyPostMock();
      const mod = await import("./easypost");
      await expect(mod.buyShippingLabel("shp_1", "rate_1")).rejects.toThrow(
        "EasyPost is not configured",
      );
    });
  });

  describe("verifyEasyPostWebhook", () => {
    it("returns false when webhook secret is empty", async () => {
      vi.stubEnv("EASYPOST_API_KEY", "");
      vi.stubEnv("EASYPOST_WEBHOOK_SECRET", "");
      setupEasyPostMock();
      const mod = await import("./easypost");
      expect(mod.verifyEasyPostWebhook("body", "sig")).toBe(false);
    });

    it("verifies valid webhook signature", async () => {
      vi.stubEnv("EASYPOST_API_KEY", "");
      vi.stubEnv("EASYPOST_WEBHOOK_SECRET", "webhook-secret");
      setupEasyPostMock();

      const { createHmac } = await import("crypto");
      const body = '{"event":"tracker.updated"}';
      const expected = createHmac("sha256", "webhook-secret").update(body).digest("hex");

      const mod = await import("./easypost");
      expect(mod.verifyEasyPostWebhook(body, expected)).toBe(true);
    });

    it("rejects invalid webhook signature", async () => {
      vi.stubEnv("EASYPOST_API_KEY", "");
      vi.stubEnv("EASYPOST_WEBHOOK_SECRET", "webhook-secret");
      setupEasyPostMock();
      const mod = await import("./easypost");
      expect(mod.verifyEasyPostWebhook("body", "bad-sig")).toBe(false);
    });
  });
});
