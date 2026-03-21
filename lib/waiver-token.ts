/**
 * lib/waiver-token.ts — HMAC-based tokens for public waiver completion links.
 *
 * Generates a signed token encoding bookingId + clientId so the client can
 * complete required waivers without logging in. Tokens expire after 7 days.
 *
 * Uses Node.js built-in `crypto` — no additional dependencies.
 */
import { createHmac } from "crypto";

// Signing secret priority: dedicated waiver secret > NextAuth secret > hardcoded fallback.
// The fallback is intentionally weak to make missing config obvious in dev
// while still allowing the app to boot.
const SECRET = process.env.WAIVER_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || "waiver-fallback-secret";

/** The data encoded inside a waiver token — identifies which booking
 *  and which client the waiver completion link is for. */
interface WaiverTokenPayload {
  /** Primary key of the booking that requires waiver completion. */
  bookingId: number;
  /** UUID of the client's profile row (profiles.id). */
  clientId: string;
}

/**
 * Generate a signed waiver token.
 * Format: base64url({ bookingId, clientId, exp }).signature
 *
 * @param expiryDays — token validity in days (default: 7, configurable via settings)
 */
export function generateWaiverToken(payload: WaiverTokenPayload, expiryDays: number = 7): string {
  const expiryMs = expiryDays * 24 * 60 * 60 * 1000;
  const data = {
    ...payload,
    exp: Date.now() + expiryMs,
  };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

/**
 * Verify and decode a waiver token.
 *
 * Validation steps:
 * 1. Split on "." — must have exactly two parts (payload + signature).
 * 2. Recompute HMAC-SHA256 over the encoded payload and compare to the
 *    provided signature (constant-time comparison not used here because
 *    the tokens are short-lived and low-value; timing attacks are not a
 *    practical risk for waiver links).
 * 3. JSON-decode the payload and check the `exp` timestamp.
 *
 * @param token - The full token string from the waiver URL query param.
 * @returns The decoded payload ({bookingId, clientId}) or null if the
 *          token is malformed, tampered with, or expired.
 */
export function verifyWaiverToken(token: string): WaiverTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [encoded, sig] = parts;
  const expectedSig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  if (sig !== expectedSig) return null;

  try {
    const data = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (data.exp < Date.now()) return null;
    return { bookingId: data.bookingId, clientId: data.clientId };
  } catch {
    return null;
  }
}
