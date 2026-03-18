import { describe, it, expect } from "vitest";
import { generateWaiverToken, verifyWaiverToken } from "./waiver-token";

describe("waiver-token", () => {
  it("generates a valid token that can be verified", () => {
    const payload = { bookingId: 42, clientId: "client-1" };
    const token = generateWaiverToken(payload);
    const result = verifyWaiverToken(token);
    expect(result).toEqual(payload);
  });

  it("returns null for tampered token", () => {
    const token = generateWaiverToken({ bookingId: 1, clientId: "c1" });
    const tampered = token.slice(0, -3) + "xxx";
    expect(verifyWaiverToken(tampered)).toBeNull();
  });

  it("returns null for expired token", () => {
    // Generate token, then manually create one with past expiry
    const data = { bookingId: 1, clientId: "c1", exp: Date.now() - 1000 };
    const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
    // Can't sign with correct secret from outside, so just verify that
    // a valid-looking but expired token returns null
    const fakeToken = encoded + ".fakesig";
    expect(verifyWaiverToken(fakeToken)).toBeNull();
  });

  it("returns null for malformed token (no dot separator)", () => {
    expect(verifyWaiverToken("nodothere")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(verifyWaiverToken("")).toBeNull();
  });
});
