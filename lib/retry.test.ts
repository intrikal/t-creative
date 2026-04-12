/**
 * Tests for the generic retry helper used by Twilio, email, and Square calls.
 *
 * Covers:
 *  - Succeeds first try → no retry
 *  - Fails then succeeds → retries and returns result
 *  - Fails all retries → throws last error, Sentry capture
 *  - Respects maxRetries config
 *  - Exponential backoff timing (fake timers)
 *  - Non-retryable 4xx → throws immediately without retry
 *  - Retries 429 rate-limit, 5xx server, and network errors
 *  - Retry-After header respected for 429
 *  - Label appears in Sentry breadcrumbs and tags
 *
 * Mocks: @sentry/nextjs (addBreadcrumb, captureException).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockAddBreadcrumb = vi.fn();
const mockCaptureException = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb: mockAddBreadcrumb,
  captureException: mockCaptureException,
}));

import { withRetry } from "./retry";

describe("lib/retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Success / failure paths ──────────────────────────────────────────────

  it("returns the result on first success without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("ok");

    const result = await withRetry(fn, { backoff: [1] });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(mockAddBreadcrumb).not.toHaveBeenCalled();
  });

  it("retries on transient failure and returns result on eventual success", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockResolvedValue("recovered");

    const result = await withRetry(fn, { maxRetries: 2, backoff: [1, 1] });

    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws the last error after exhausting all retries", async () => {
    const error = new Error("server down");
    const fn = vi.fn().mockRejectedValue(error);

    await expect(
      withRetry(fn, { maxRetries: 2, backoff: [1, 1] }),
    ).rejects.toThrow("server down");

    // initial attempt + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3);
    expect(mockCaptureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: expect.objectContaining({ retry_exhausted: "true" }),
      }),
    );
  });

  // ── maxRetries ───────────────────────────────────────────────────────────

  it("respects maxRetries configuration", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    await expect(
      withRetry(fn, { maxRetries: 1, backoff: [1] }),
    ).rejects.toThrow("fail");

    // initial + 1 retry = 2 calls
    expect(fn).toHaveBeenCalledTimes(2);
  });

  // ── Backoff timing ──────────────────────────────────────────────────────

  it("waits with exponential backoff between attempts", async () => {
    vi.useFakeTimers();

    const fn = vi.fn()
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockResolvedValue("done");

    const promise = withRetry(fn, { maxRetries: 2, backoff: [1000, 2000] });

    // After first failure → sleep(1000)
    await vi.advanceTimersByTimeAsync(1000);
    // After second failure → sleep(2000)
    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;
    expect(result).toBe("done");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("reuses the last backoff value when retries exceed backoff array length", async () => {
    vi.useFakeTimers();

    const fn = vi.fn()
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockResolvedValue("done");

    // Only 1 backoff value but 3 retries — last value (500) is reused
    const promise = withRetry(fn, { maxRetries: 3, backoff: [500] });

    await vi.advanceTimersByTimeAsync(500); // retry 1
    await vi.advanceTimersByTimeAsync(500); // retry 2
    await vi.advanceTimersByTimeAsync(500); // retry 3

    const result = await promise;
    expect(result).toBe("done");
    expect(fn).toHaveBeenCalledTimes(4);
  });

  // ── Retryable vs non-retryable errors ────────────────────────────────────

  it("throws non-retryable 4xx errors immediately without retrying", async () => {
    const error = { statusCode: 400, message: "bad request" };
    const fn = vi.fn().mockRejectedValue(error);

    await expect(
      withRetry(fn, { maxRetries: 3, backoff: [1, 1, 1] }),
    ).rejects.toEqual(error);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(mockAddBreadcrumb).not.toHaveBeenCalled();
  });

  it("does not retry 401 or 403 errors", async () => {
    const fn401 = vi.fn().mockRejectedValue({ statusCode: 401 });
    await expect(withRetry(fn401, { maxRetries: 2, backoff: [1] })).rejects.toEqual({ statusCode: 401 });
    expect(fn401).toHaveBeenCalledTimes(1);

    const fn403 = vi.fn().mockRejectedValue({ statusCode: 403 });
    await expect(withRetry(fn403, { maxRetries: 2, backoff: [1] })).rejects.toEqual({ statusCode: 403 });
    expect(fn403).toHaveBeenCalledTimes(1);
  });

  it("retries 429 rate-limit errors", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ statusCode: 429 })
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { maxRetries: 1, backoff: [1] });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries 5xx server errors", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ statusCode: 502 })
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { maxRetries: 1, backoff: [1] });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries network errors (no status code)", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValue("ok");

    const result = await withRetry(fn, { maxRetries: 1, backoff: [1] });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  // ── Retry-After header ──────────────────────────────────────────────────

  it("respects Retry-After header on 429 errors instead of backoff", async () => {
    vi.useFakeTimers();

    const fn = vi.fn()
      .mockRejectedValueOnce({
        statusCode: 429,
        headers: { "retry-after": "3" },
      })
      .mockResolvedValue("ok");

    const promise = withRetry(fn, { maxRetries: 1, backoff: [100] });

    // Should wait 3000ms (Retry-After: 3 seconds) not 100ms (backoff)
    await vi.advanceTimersByTimeAsync(3000);

    const result = await promise;
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("respects Retry-After from a Headers-like .get() interface", async () => {
    vi.useFakeTimers();

    const fn = vi.fn()
      .mockRejectedValueOnce({
        statusCode: 429,
        headers: { get: (key: string) => (key === "retry-after" ? "2" : null) },
      })
      .mockResolvedValue("ok");

    const promise = withRetry(fn, { maxRetries: 1, backoff: [100] });

    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;
    expect(result).toBe("ok");
  });

  // ── Label in Sentry ─────────────────────────────────────────────────────

  it("includes the label in Sentry breadcrumbs on retry", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ statusCode: 500 })
      .mockResolvedValue("ok");

    await withRetry(fn, { label: "square.payments.create", maxRetries: 1, backoff: [1] });

    expect(mockAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("square.payments.create"),
        category: "retry",
        level: "warning",
      }),
    );
  });

  it("includes the label in Sentry tags when retries are exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("down"));

    await expect(
      withRetry(fn, { label: "resend.send", maxRetries: 0 }),
    ).rejects.toThrow();

    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tags: { retry_label: "resend.send", retry_exhausted: "true" },
      }),
    );
  });
});
