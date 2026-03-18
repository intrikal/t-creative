/**
 * lib/waiver-token.ts — HMAC-based tokens for public waiver completion links.
 *
 * Generates a signed token encoding bookingId + clientId so the client can
 * complete required waivers without logging in. Tokens expire after 7 days.
 *
 * Uses Node.js built-in `crypto` — no additional dependencies.
 */
import { createHmac } from "crypto";

const SECRET = process.env.WAIVER_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || "waiver-fallback-secret";
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface WaiverTokenPayload {
  bookingId: number;
  clientId: string;
}

/**
 * Generate a signed waiver token.
 * Format: base64url({ bookingId, clientId, exp }).signature
 */
export function generateWaiverToken(payload: WaiverTokenPayload): string {
  const data = {
    ...payload,
    exp: Date.now() + EXPIRY_MS,
  };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

/**
 * Verify and decode a waiver token. Returns null if invalid or expired.
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
