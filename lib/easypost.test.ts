import { describe, it, expect, vi, beforeEach } from "vitest";

const mockShipmentCreate = vi.fn().mockResolvedValue({
  id: "shp_123",
  rates: [
    { id: "rate_1", carrier: "USPS", service: "Priority", rate: "7.50", delivery_days: 3 },
    { id: "rate_2", carrier: "UPS", service: "Ground", rate: "12.00", delivery_days: 5 },
  ],
});

const mockShipmentBuy = vi.fn().mockResolvedValue({
  tracking_code: "TRACK123",
  tracker: {
    tracking_code: "TRACK123",
    public_url: "https://track.example.com/TRACK123",
  },
  postage_label: { label_url: "https://label.example.com/label.pdf" },
  selected_rate: { carrier: "USPS", service: "Priority" },
});

function setupMocks() {
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
  vi.doMock("@easypost/api", () => ({
    default: vi.fn().mockImplementation(function () {
      return {
        Shipment: {
          create: mockShipmentCreate,
          buy: mockShipmentBuy,
        },
      };
    }),
  }));
  vi.doMock("@/db/schema", () => ({}));
}

describe("easypost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when not configured", () => {
    it("isEasyPostConfigured returns false", async () => {
      vi.resetModules();
      delete process.env.EASYPOST_API_KEY;
      setupMocks();
      const { isEasyPostConfigured } = await import("./easypost");
      expect(isEasyPostConfigured()).toBe(false);
    });

    it("easypostClient is null", async () => {
      vi.resetModules();
      delete process.env.EASYPOST_API_KEY;
      setupMocks();
      const { easypostClient } = await import("./easypost");
      expect(easypostClient).toBeNull();
    });
  });

  describe("when configured", () => {
    it("isEasyPostConfigured returns true", async () => {
      vi.resetModules();
      process.env.EASYPOST_API_KEY = "test_key";
      setupMocks();
      const { isEasyPostConfigured } = await import("./easypost");
      expect(isEasyPostConfigured()).toBe(true);
    });

    it("getShippingRates creates shipment and returns sorted rates", async () => {
      vi.resetModules();
      process.env.EASYPOST_API_KEY = "test_key";
      setupMocks();
      const { getShippingRates } = await import("./easypost");
      const result = await getShippingRates({
        name: "John",
        street1: "123 Main",
        city: "LA",
        state: "CA",
        zip: "90001",
        country: "US",
      });
      expect(result.shipmentId).toBe("shp_123");
      expect(result.rates).toHaveLength(2);
      expect(result.rates[0].rateInCents).toBe(750);
      expect(result.rates[0].carrier).toBe("USPS");
      expect(result.rates[1].rateInCents).toBe(1200);
    });

    it("buyShippingLabel returns tracking info", async () => {
      vi.resetModules();
      process.env.EASYPOST_API_KEY = "test_key";
      setupMocks();
      const { buyShippingLabel } = await import("./easypost");
      const result = await buyShippingLabel("shp_123", "rate_1");
      expect(result.trackingNumber).toBe("TRACK123");
      expect(result.trackingUrl).toBe("https://track.example.com/TRACK123");
      expect(result.labelUrl).toBe("https://label.example.com/label.pdf");
      expect(result.carrier).toBe("USPS");
      expect(result.service).toBe("Priority");
    });
  });
});
