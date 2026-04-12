// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for lib/cron-monitor — withCronMonitoring() wrapper.
 *
 * Covers:
 *  - Successful cron: cron_success audit row written, response ok:true, recordsProcessed echoed
 *  - Failed cron: Sentry.captureException called, cron_failure audit row written, response ok:false
 *  - Alert webhook: sent when CRON_ALERT_WEBHOOK_URL is configured; skipped when absent
 *  - Duration tracking: durationMs ≥ 0 recorded in the audit metadata
 *  - Always 200: response status is always 200 so Vercel does not retry
 *
 * Mocks: @sentry/nextjs (addBreadcrumb, captureException), @/db (insert chain),
 * @/db/schema (auditLog table reference), global fetch (alert webhook).
 */

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

// mockInsertValues: captures the audit_log row passed to db.insert(...).values(...)
const mockInsertValues = vi.fn();
// mockAddBreadcrumb: captures Sentry breadcrumb calls at cron start
const mockAddBreadcrumb = vi.fn();
// mockCaptureException: captures Sentry exception reports on failure
const mockCaptureException = vi.fn();
// mockFetch: captures outbound alert webhook requests
const mockFetch = vi.fn();

// Mock Sentry so tests don't send real telemetry
vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb: mockAddBreadcrumb,
  captureException: mockCaptureException,
}));

// Mock the database so tests don't need a real Postgres connection
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({ values: mockInsertValues }),
  },
}));

// Mock the schema import — only the table reference is needed
vi.mock("@/db/schema", () => ({
  auditLog: {},
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("lib/cron-monitor", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockInsertValues.mockResolvedValue(undefined);
    mockFetch.mockResolvedValue({ ok: true });
    // Replace the global fetch with a mock so alert webhooks are intercepted
    vi.stubGlobal("fetch", mockFetch);
  });

  describe("withCronMonitoring", () => {
    // Successful run — must write a cron_success audit row and return ok: true
    it("writes a cron_success audit row and returns ok:true on success", async () => {
      const { withCronMonitoring } = await import("./cron-monitor");

      const fn = vi.fn().mockResolvedValue({ recordsProcessed: 5 });
      const res = await withCronMonitoring("booking-reminders", fn);

      expect(fn).toHaveBeenCalledOnce();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "export",
          entityType: "cron_success",
          entityId: "booking-reminders",
          actorId: null,
        }),
      );
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.cronName).toBe("booking-reminders");
      expect(body.recordsProcessed).toBe(5);
    });

    // Failed run — must write a cron_failure audit row, capture to Sentry, return ok: false
    it("writes a cron_failure audit row and returns ok:false on failure", async () => {
      vi.stubEnv("CRON_ALERT_WEBHOOK_URL", "https://hooks.example.com/alert");
      const { withCronMonitoring } = await import("./cron-monitor");

      const err = new Error("Something exploded");
      const res = await withCronMonitoring("daily-flash", vi.fn().mockRejectedValue(err));

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "export",
          entityType: "cron_failure",
          entityId: "daily-flash",
        }),
      );
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.cronName).toBe("daily-flash");
      expect(body.error).toBe("Something exploded");
    });

    // Sentry must receive the exception with a {cron: cronName} tag for filtering
    it("calls Sentry.captureException with the cron tag when the handler throws", async () => {
      const { withCronMonitoring } = await import("./cron-monitor");

      const err = new Error("Cron failed hard");
      await withCronMonitoring("membership-reminders", vi.fn().mockRejectedValue(err));

      expect(mockCaptureException).toHaveBeenCalledWith(
        err,
        expect.objectContaining({ tags: { cron: "membership-reminders" } }),
      );
    });

    // Alert webhook must fire when CRON_ALERT_WEBHOOK_URL is set
    it("sends the alert webhook when CRON_ALERT_WEBHOOK_URL is configured", async () => {
      vi.stubEnv("CRON_ALERT_WEBHOOK_URL", "https://discord.example.com/webhook/abc");
      const { withCronMonitoring } = await import("./cron-monitor");

      await withCronMonitoring("waitlist-expiry", vi.fn().mockRejectedValue(new Error("boom")));

      expect(mockFetch).toHaveBeenCalledWith(
        "https://discord.example.com/webhook/abc",
        expect.objectContaining({ method: "POST" }),
      );
    });

    // When no webhook URL is present, fetch must NOT be called at all
    it("skips the alert webhook when CRON_ALERT_WEBHOOK_URL is not configured", async () => {
      vi.stubEnv("CRON_ALERT_WEBHOOK_URL", "");
      const { withCronMonitoring } = await import("./cron-monitor");

      await withCronMonitoring("fill-reminders", vi.fn().mockRejectedValue(new Error("oops")));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    // durationMs must be a non-negative number so the health dashboard can display it
    it("records elapsed durationMs in the audit log metadata", async () => {
      const { withCronMonitoring } = await import("./cron-monitor");

      await withCronMonitoring("review-requests", vi.fn().mockResolvedValue({}));

      const row = mockInsertValues.mock.calls[0][0];
      expect(row.metadata).toMatchObject({ durationMs: expect.any(Number) });
      expect(row.metadata.durationMs).toBeGreaterThanOrEqual(0);
    });

    // Vercel retries the cron if it receives non-200 — always return 200 even on failure
    it("always returns HTTP 200 to prevent Vercel retry storms", async () => {
      const { withCronMonitoring } = await import("./cron-monitor");

      const res = await withCronMonitoring(
        "always-200",
        vi.fn().mockRejectedValue(new Error("terrible error")),
      );

      expect(res.status).toBe(200);
    });
  });
});
