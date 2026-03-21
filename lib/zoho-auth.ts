/**
 * Zoho OAuth2 shared token management.
 *
 * Both Zoho CRM (`lib/zoho.ts`) and Zoho Campaigns (`lib/zoho-campaigns.ts`)
 * use the same OAuth2 credentials and share a single access token cache.
 *
 * @module lib/zoho-auth
 */

// OAuth2 credentials — set in .env. The refresh token is obtained once via
// Zoho's self-client flow (API Console → Generate Code → Exchange for tokens).
const clientId = process.env.ZOHO_CLIENT_ID;
const clientSecret = process.env.ZOHO_CLIENT_SECRET;
const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
/** Zoho's centralised OAuth endpoint — same for CRM, Campaigns, and all products. */
const accountsUrl = "https://accounts.zoho.com";

/** Whether the base Zoho OAuth2 credentials are configured. */
export function isZohoAuthConfigured(): boolean {
  return !!(clientId && clientSecret && refreshToken);
}

// In-memory token cache. Shared across all Zoho modules within the same
// Node.js process. Survives between requests in long-lived server environments
// (e.g. `next start`) but resets on cold starts in serverless (Vercel).
let _accessToken: string | null = null;
let _tokenExpiresAt = 0;

/**
 * Returns a valid Zoho access token, refreshing via OAuth2 if the cached
 * token is expired or missing.
 *
 * POSTs to `accounts.zoho.com/oauth/v2/token` with grant_type=refresh_token
 * and the stored client credentials. Zoho returns { access_token, expires_in }.
 *
 * The cached token is expired 5 minutes early (line 52) to avoid race
 * conditions where a request starts with a token that expires mid-flight.
 *
 * @returns A valid Zoho OAuth2 access token string.
 * @throws If credentials are missing or the Zoho token endpoint returns an error.
 */
export async function getZohoAccessToken(): Promise<string> {
  if (_accessToken && Date.now() < _tokenExpiresAt) {
    return _accessToken;
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId!,
    client_secret: clientSecret!,
    refresh_token: refreshToken!,
  });

  const res = await fetch(`${accountsUrl}/oauth/v2/token?${params.toString()}`, {
    method: "POST",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho OAuth refresh failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  _accessToken = data.access_token;
  // Expire 5 minutes early to avoid edge cases
  _tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000;

  return _accessToken;
}
