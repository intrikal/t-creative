/**
 * invite — JWT-based invite tokens for assistant role assignment.
 *
 * Trini (admin) generates invite links containing a signed JWT.
 * When a new user signs up via an invite link, the callback route
 * verifies the token and assigns the "assistant" role.
 */
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.INVITE_SECRET);

type InvitePayload = {
  email: string;
  role: "assistant";
};

/**
 * Create a signed invite token for an email address.
 * Valid for 48 hours.
 */
export async function createInviteToken(email: string): Promise<string> {
  return new SignJWT({ email, role: "assistant" } satisfies InvitePayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("48h")
    .sign(secret);
}

/**
 * Verify and decode an invite token.
 * Returns the payload if valid, null if expired or tampered.
 */
export async function verifyInviteToken(token: string): Promise<InvitePayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as InvitePayload;
  } catch {
    return null;
  }
}
