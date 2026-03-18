import { describe, it, expect, vi, beforeEach } from "vitest";

describe("waiver-token", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("WAIVER_TOKEN_SECRET", "test-secret-key-for-waivers");
    vi.resetModules();
  });

  it("generates a valid token string", async () => {
    const { generateWaiverToken } = await import("./waiver-token");
    const token = generateWaiverToken({ bookingId: 1, clientId: "client-1" });
    expect(typeof token).toBe("string");
    expect(token).toContain(".");
    expect(token.split(".")).toHaveLength(2);
  });

  it("token contains correct payload (bookingId, clientId)", async () => {
    const { generateWaiverToken, verifyWaiverToken } = await import("./waiver-token");
    const token = generateWaiverToken({ bookingId: 42, clientId: "client-abc" });
    const payload = verifyWaiverToken(token);
    expect(payload).toEqual({ bookingId: 42, clientId: "client-abc" });
  });

  it("verification succeeds with valid token", async () => {
    const { generateWaiverToken, verifyWaiverToken } = await import("./waiver-token");
    const token = generateWaiverToken({ bookingId: 10, clientId: "c-10" });
    const result = verifyWaiverToken(token);
    expect(result).not.toBeNull();
    expect(result!.bookingId).toBe(10);
    expect(result!.clientId).toBe("c-10");
  });

  it("verification fails with expired token", async () => {
    const { generateWaiverToken, verifyWaiverToken } = await import("./waiver-token");
    // Generate a token, then advance time past expiry (7 days)
    const token = generateWaiverToken({ bookingId: 1, clientId: "c-1" });

    // Manually decode and re-encode with expired timestamp
    const [encoded] = token.split(".");
    const data = JSON.parse(Buffer.from(encoded, "base64url").toString());
    data.exp = Date.now() - 1000; // expired 1 second ago
    const expiredEncoded = Buffer.from(JSON.stringify(data)).toString("base64url");

    // Re-sign with the same secret
    const { createHmac } = await import("crypto");
    const sig = createHmac("sha256", "test-secret-key-for-waivers")
      .update(expiredEncoded)
      .digest("base64url");
    const expiredToken = `${expiredEncoded}.${sig}`;

    expect(verifyWaiverToken(expiredToken)).toBeNull();
  });

  it("verification fails with tampered token", async () => {
    const { generateWaiverToken, verifyWaiverToken } = await import("./waiver-token");
    const token = generateWaiverToken({ bookingId: 1, clientId: "c-1" });

    // Tamper with the payload
    const [encoded, sig] = token.split(".");
    const data = JSON.parse(Buffer.from(encoded, "base64url").toString());
    data.bookingId = 999; // tamper
    const tamperedEncoded = Buffer.from(JSON.stringify(data)).toString("base64url");
    const tamperedToken = `${tamperedEncoded}.${sig}`;

    expect(verifyWaiverToken(tamperedToken)).toBeNull();
  });

  it("verification returns null for malformed tokens", async () => {
    const { verifyWaiverToken } = await import("./waiver-token");
    expect(verifyWaiverToken("")).toBeNull();
    expect(verifyWaiverToken("no-dot-here")).toBeNull();
    expect(verifyWaiverToken("a.b.c")).toBeNull();
  });
});
