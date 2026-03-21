// @vitest-environment node
// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
// afterEach: runs a cleanup function after every test in the current describe block
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for the invite token module — JWT-based assistant invitation system.
 *
 * Covers:
 *  - createInviteToken: returns a 3-part JWT, encodes email + "assistant" role,
 *    sets 48-hour expiry
 *  - verifyInviteToken: valid token returns payload, tampered/invalid/different-secret
 *    tokens return null, expired tokens return null
 *
 * No external mocks — uses the real jose JWT library with a test INVITE_SECRET.
 * Runs in Node environment for crypto support.
 */
describe("lib/invite", () => {
  // Set a consistent test secret and clear module cache before each test
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("INVITE_SECRET", "test-invite-secret-for-unit-tests");
  });

  // Restore env vars after each test to prevent cross-test leakage
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Tests for JWT creation — the invite link contains this token as a URL param
  describe("createInviteToken", () => {
    it("returns a JWT string with three dot-separated parts", async () => {
      const { createInviteToken } = await import("./invite");
      const token = await createInviteToken("test@example.com");

      expect(typeof token).toBe("string");
      const parts = token.split(".");
      expect(parts).toHaveLength(3);
    });

    it("encodes the email and role in the payload", async () => {
      const { createInviteToken } = await import("./invite");
      const token = await createInviteToken("assistant@example.com");

      // Decode the payload (middle part of JWT) without verifying signature
      const payloadBase64 = token.split(".")[1];
      const payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString());

      expect(payload.email).toBe("assistant@example.com");
      expect(payload.role).toBe("assistant");
    });

    it("sets an expiration time roughly 48 hours in the future", async () => {
      const before = Math.floor(Date.now() / 1000);
      const { createInviteToken } = await import("./invite");
      const token = await createInviteToken("exp@example.com");
      const after = Math.floor(Date.now() / 1000);

      const payloadBase64 = token.split(".")[1];
      const payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString());

      const fortyEightHours = 48 * 60 * 60;
      expect(payload.exp).toBeGreaterThanOrEqual(before + fortyEightHours);
      expect(payload.exp).toBeLessThanOrEqual(after + fortyEightHours + 5);
    });
  });

  // Tests for JWT verification — runs on the accept-invite page to validate the token
  describe("verifyInviteToken", () => {
    it("returns the payload for a valid token", async () => {
      const { createInviteToken, verifyInviteToken } = await import("./invite");
      const token = await createInviteToken("valid@example.com");
      const payload = await verifyInviteToken(token);

      expect(payload).not.toBeNull();
      expect(payload?.email).toBe("valid@example.com");
      expect(payload?.role).toBe("assistant");
    });

    it("returns null for a tampered token", async () => {
      const { createInviteToken, verifyInviteToken } = await import("./invite");
      const token = await createInviteToken("tamper@example.com");

      // Corrupt the signature (last segment)
      const parts = token.split(".");
      const tampered = `${parts[0]}.${parts[1]}.invalidsignature`;

      const payload = await verifyInviteToken(tampered);
      expect(payload).toBeNull();
    });

    it("returns null for a completely invalid string", async () => {
      const { verifyInviteToken } = await import("./invite");
      const payload = await verifyInviteToken("not.a.jwt");
      expect(payload).toBeNull();
    });

    it("returns null for a token signed with a different secret", async () => {
      // Create token with one secret
      vi.stubEnv("INVITE_SECRET", "secret-A");
      vi.resetModules();
      const moduleA = await import("./invite");
      const token = await moduleA.createInviteToken("cross@example.com");

      // Verify with a different secret
      vi.stubEnv("INVITE_SECRET", "secret-B");
      vi.resetModules();
      const moduleB = await import("./invite");
      const payload = await moduleB.verifyInviteToken(token);

      expect(payload).toBeNull();
    });

    it("returns null for an expired token", async () => {
      const { createInviteToken } = await import("./invite");

      // Create a token then advance time past 48h
      const token = await createInviteToken("expired@example.com");

      vi.setSystemTime(new Date(Date.now() + 49 * 60 * 60 * 1000));

      vi.resetModules();
      const { verifyInviteToken } = await import("./invite");
      const payload = await verifyInviteToken(token);

      vi.useRealTimers();
      expect(payload).toBeNull();
    });
  });
});
