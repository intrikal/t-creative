/**
 * Square SDK client — singleton for server-side use only.
 *
 * Initialises a single `SquareClient` instance. The instance is module-scoped
 * and reused across requests, mirroring the pattern in `db/index.ts`.
 *
 * Graceful degradation: when Square env vars are missing the app still
 * boots (cash-only mode). Always check `isSquareConfigured()` before
 * calling any Square API.
 *
 * @module lib/square/client
 */
import { SquareClient, SquareEnvironment } from "square";

const accessToken = process.env.SQUARE_ACCESS_TOKEN;
const locationId = process.env.SQUARE_LOCATION_ID;
const environment =
  process.env.SQUARE_ENVIRONMENT === "production"
    ? SquareEnvironment.Production
    : SquareEnvironment.Sandbox;

/** Square location ID for the studio. */
export const SQUARE_LOCATION_ID = locationId ?? "";

/** Webhook signature key for verifying inbound Square webhooks. */
export const SQUARE_WEBHOOK_SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "";

/** Whether Square credentials are configured (access token + location). */
export function isSquareConfigured(): boolean {
  return !!(accessToken && locationId);
}

/**
 * Shared Square SDK client instance.
 *
 * Instantiated eagerly (not lazy) because the SquareClient constructor
 * does not throw when the token is empty — it only fails on actual API
 * calls, which are always guarded by `isSquareConfigured()`.
 */
export const squareClient = new SquareClient({
  token: accessToken ?? "",
  environment,
});
