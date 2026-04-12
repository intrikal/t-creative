// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for lib/alert — sendAlert() operational notification helper.
 *
 * Covers:
 *  - Discord channel: fetch called with {content} payload when URL is configured
 *  - Telegram channel: fetch called with {chat_id, text} payload when both vars are set
 *  - No channels configured: fetch not called, message logged to console.error instead
 *  - Webhook fetch failure: error is caught internally — sendAlert resolves without throwing
 *
 * Mocks: global fetch (outbound HTTP calls).
 * Uses vi.stubEnv + vi.resetModules to test each env var combination in isolation.
 */

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

// mockFetch: intercepts all outbound alert webhook/Telegram requests
const mockFetch = vi.fn();

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("lib/alert", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    // Replace global fetch so no real HTTP calls leave the test process
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({ ok: true });
  });

  describe("sendAlert", () => {
    // Discord webhook receives a {content} payload — compatible with Discord Incoming Webhooks
    it("posts to Discord when DISCORD_ALERT_WEBHOOK_URL is configured", async () => {
      vi.stubEnv("DISCORD_ALERT_WEBHOOK_URL", "https://discord.example.com/api/webhooks/abc");

      const { sendAlert } = await import("./alert");
      await sendAlert("test alert message");

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith(
        "https://discord.example.com/api/webhooks/abc",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "test alert message" }),
        }),
      );
    });

    // Telegram receives {chat_id, text} — requires both BOT_TOKEN and CHAT_ID
    it("posts to Telegram when both TELEGRAM env vars are configured", async () => {
      vi.stubEnv("TELEGRAM_ALERT_BOT_TOKEN", "bot987654321:TOKEN");
      vi.stubEnv("TELEGRAM_ALERT_CHAT_ID", "-100123456789");

      const { sendAlert } = await import("./alert");
      await sendAlert("telegram alert");

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.telegram.org/botbot987654321:TOKEN/sendMessage",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ chat_id: "-100123456789", text: "telegram alert" }),
        }),
      );
    });

    // Both channels can fire in parallel when both are configured
    it("sends to both Discord and Telegram when all vars are configured", async () => {
      vi.stubEnv("DISCORD_ALERT_WEBHOOK_URL", "https://discord.example.com/webhook");
      vi.stubEnv("TELEGRAM_ALERT_BOT_TOKEN", "botABC:TOKEN");
      vi.stubEnv("TELEGRAM_ALERT_CHAT_ID", "-100999");

      const { sendAlert } = await import("./alert");
      await sendAlert("dual channel alert");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // No channels configured → must not call fetch; logs to stderr so it's still visible in Vercel logs
    it("skips fetch and logs to console.error when no channels are configured", async () => {
      // Explicitly clear all channel vars for deterministic behaviour
      vi.stubEnv("DISCORD_ALERT_WEBHOOK_URL", "");
      vi.stubEnv("TELEGRAM_ALERT_BOT_TOKEN", "");
      vi.stubEnv("TELEGRAM_ALERT_CHAT_ID", "");

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { sendAlert } = await import("./alert");
      await sendAlert("nobody is listening");

      expect(mockFetch).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith("[ALERT] nobody is listening");

      errorSpy.mockRestore();
    });

    // Webhook delivery failures must never propagate — sendAlert is a best-effort side effect
    it("resolves without throwing when the Discord webhook request fails", async () => {
      vi.stubEnv("DISCORD_ALERT_WEBHOOK_URL", "https://discord.example.com/webhook");
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const { sendAlert } = await import("./alert");

      await expect(sendAlert("failing webhook")).resolves.toBeUndefined();
    });

    // Telegram failures are also silently caught
    it("resolves without throwing when the Telegram request fails", async () => {
      vi.stubEnv("TELEGRAM_ALERT_BOT_TOKEN", "botBROKEN");
      vi.stubEnv("TELEGRAM_ALERT_CHAT_ID", "-1");
      mockFetch.mockRejectedValueOnce(new Error("Telegram 429"));

      const { sendAlert } = await import("./alert");

      await expect(sendAlert("telegram failure")).resolves.toBeUndefined();
    });
  });
});
