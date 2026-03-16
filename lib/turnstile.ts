/**
 * Server-side Cloudflare Turnstile token verification.
 *
 * Call this in any server action or API route handler that processes
 * unauthenticated form submissions before touching the database or sending emails.
 */
export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // In development without a key configured, skip verification
    if (process.env.NODE_ENV === "development") return true;
    return false;
  }

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, response: token }),
  });

  const data = (await res.json()) as { success: boolean };
  return data.success;
}
