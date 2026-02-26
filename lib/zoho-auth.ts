/**
 * Zoho OAuth2 shared token management.
 *
 * Both Zoho CRM (`lib/zoho.ts`) and Zoho Campaigns (`lib/zoho-campaigns.ts`)
 * use the same OAuth2 credentials and share a single access token cache.
 *
 * @module lib/zoho-auth
 */

const clientId = process.env.ZOHO_CLIENT_ID;
const clientSecret = process.env.ZOHO_CLIENT_SECRET;
const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
const accountsUrl = "https://accounts.zoho.com";

/** Whether the base Zoho OAuth2 credentials are configured. */
export function isZohoAuthConfigured(): boolean {
  return !!(clientId && clientSecret && refreshToken);
}

let _accessToken: string | null = null;
let _tokenExpiresAt = 0;

/**
 * Returns a valid Zoho access token, refreshing if expired.
 * Zoho access tokens last ~1 hour; the refresh token is long-lived.
 * The token is scoped to all Zoho products the refresh token was granted for.
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
