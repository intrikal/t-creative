/**
 * Server-side Google reCAPTCHA v3 token verification.
 *
 * Call this in any server action or API route handler that processes
 * unauthenticated form submissions before touching the database or sending emails.
 */
import * as Sentry from "@sentry/nextjs";

export async function verifyRecaptchaToken(token: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    // In development without a key configured, skip verification
    if (process.env.NODE_ENV === "development") return true;
    return false;
  }

  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }).toString(),
    });

    const data = (await res.json()) as { success: boolean };
    return data.success;
  } catch (err) {
    Sentry.captureException(err);
    return false;
  }
}
