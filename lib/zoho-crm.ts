/**
 * Zoho CRM contact management — focused module for creating and updating
 * CRM Contacts independently of the deal/note operations in lib/zoho.ts.
 *
 * Graceful degradation: when ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN
 * are missing, all public functions are no-ops so the app still boots without Zoho CRM.
 *
 * Uses the Zoho CRM v7 REST API directly via fetch (no SDK dependency).
 * Shares the same OAuth2 credentials and token cache as lib/zoho.ts via zoho-auth.ts.
 *
 * @module lib/zoho-crm
 */
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, syncLog } from "@/db/schema";
import { isZohoAuthConfigured, getZohoAccessToken } from "@/lib/zoho-auth";

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

// ZOHO_API_DOMAIN varies by data center (US: zohoapis.com, EU: zohoapis.eu, etc.).
// Defaults to the US domain if not set.
const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";

/** Whether Zoho CRM contact integration is configured. */
export function isZohoCrmConfigured(): boolean {
  return isZohoAuthConfigured();
}

/* ------------------------------------------------------------------ */
/*  Low-level API helper                                               */
/* ------------------------------------------------------------------ */

/**
 * Low-level wrapper around the Zoho CRM v7 REST API.
 *
 * Handles OAuth token injection and JSON parsing. Throws on non-2xx
 * responses so callers can catch and log to syncLog.
 *
 * Token refresh is handled by `getZohoAccessToken()` in zoho-auth.ts
 * (caches in memory, auto-refreshes when expired).
 */
async function crmFetch(
  path: string,
  options: { method?: string; body?: Record<string, unknown> } = {},
): Promise<Record<string, unknown>> {
  // Refresh-or-return the cached OAuth token — never expires mid-request.
  const token = await getZohoAccessToken();
  const res = await fetch(`${apiDomain}/crm/v7${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    // Spread body only when present — fetch treats an absent body differently
    // from an empty one, and GET requests must not include a body at all.
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!res.ok) {
    // Read the response body as text so the error message includes Zoho's
    // explanation (e.g. "INVALID_TOKEN", "REQUIRED_FIELD_MISSING").
    const text = await res.text();
    throw new Error(`Zoho CRM ${options.method || "GET"} ${path} failed (${res.status}): ${text}`);
  }

  // Cast to a plain record — callers narrow the type themselves once they
  // know which Zoho endpoint they hit (e.g. result.data, result.contact).
  return (await res.json()) as Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Sync log helper                                                    */
/* ------------------------------------------------------------------ */

/**
 * Writes to `sync_log` for audit/debugging of CRM sync operations.
 * All entries are tagged provider="zoho", direction="outbound".
 *
 * Wrapped in try/catch — a logging failure must never break the
 * main CRM sync flow (defense-in-depth).
 */
async function logSync(entry: {
  status: "success" | "failed";
  entityType: string;
  localId?: string;
  remoteId?: string;
  message?: string;
  errorMessage?: string;
}) {
  try {
    // Drizzle INSERT — spreads the caller's entry fields alongside the two
    // columns that are constant for every row written by this module.
    await db.insert(syncLog).values({
      provider: "zoho",
      direction: "outbound",
      ...entry,
    });
  } catch {
    // Logging failure should never break the main flow
  }
}

/* ------------------------------------------------------------------ */
/*  Public API — all fire-and-forget, non-fatal                        */
/* ------------------------------------------------------------------ */

// Every public function below follows the same pattern:
// 1. Early-return if Zoho is not configured (graceful degradation).
// 2. Perform the API call inside try/catch.
// 3. Log success/failure to sync_log.
// 4. Capture exceptions to Sentry but never re-throw — CRM sync
//    failures must never block the primary user flow (booking, payment, etc.).

/**
 * Creates or upserts a Zoho CRM Contact. Email is the dedup key via
 * Zoho's upsert endpoint. Stores the returned Zoho Contact ID back to
 * our `profiles.zohoContactId` column.
 *
 * Fire-and-forget — never throws to the caller.
 */
export async function createZohoContact(data: {
  profileId: string;
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string | null;
  source?: string | null;
  role?: string;
  isVip?: boolean;
  description?: string;
}): Promise<void> {
  if (!isZohoCrmConfigured()) return;

  try {
    const contactData: Record<string, unknown> = {
      Email: data.email,
      First_Name: data.firstName,
      // Zoho CRM requires Last_Name — fall back to first name when absent.
      Last_Name: data.lastName || data.firstName,
    };
    // Only set optional fields when present — Zoho upsert would
    // overwrite existing values with null otherwise.
    if (data.phone) contactData.Phone = data.phone;
    if (data.source) contactData.Lead_Source = data.source;
    if (data.description) contactData.Description = data.description;
    if (data.role) contactData.Title = data.role;
    if (data.isVip) contactData.Tag = [{ name: "VIP" }];

    // POST to /Contacts/upsert — Zoho matches on duplicate_check_fields and
    // updates the existing record if found, or creates a new one if not.
    const result = await crmFetch("/Contacts/upsert", {
      method: "POST",
      body: {
        // Zoho expects an array even for a single record.
        data: [contactData],
        // Tell Zoho which field to use as the dedup key — without this it
        // would create a duplicate contact instead of updating the existing one.
        duplicate_check_fields: ["Email"],
      },
    });

    // Extract Zoho Contact ID from the upsert response — Zoho returns it
    // nested under data[0].details.id regardless of whether it was a create or update.
    const details = result.data as
      | Array<{ details?: { id?: string }; status?: string }>
      | undefined;
    const zohoContactId = details?.[0]?.details?.id;

    // Store the Zoho Contact ID locally so future calls (updateZohoContact,
    // createZohoDeal) can look it up without an extra API round-trip.
    if (zohoContactId) {
      // Drizzle UPDATE — sets zohoContactId on the matching profiles row.
      // eq(profiles.id, data.profileId) is the WHERE clause: profiles.id = $1
      await db.update(profiles).set({ zohoContactId }).where(eq(profiles.id, data.profileId));
    }

    await logSync({
      status: "success",
      entityType: "crm_contact",
      localId: data.profileId,
      remoteId: zohoContactId,
      message: `Created/upserted contact ${data.email}`,
    });
  } catch (err) {
    Sentry.captureException(err);
    await logSync({
      status: "failed",
      entityType: "crm_contact",
      localId: data.profileId,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

/**
 * Updates fields on an existing Zoho CRM Contact. Accepts an explicit
 * `zohoContactId` or falls back to the cached value on `profiles` — so
 * callers don't need to carry the Zoho ID around separately.
 *
 * `fields` is an open record to allow any Zoho Contact field (e.g.
 * `{ Phone: "...", Lead_Source: "..." }`) without coupling this module
 * to a fixed schema.
 *
 * Fire-and-forget — never throws to the caller.
 */
export async function updateZohoContact(data: {
  profileId: string;
  zohoContactId?: string;
  fields: Record<string, unknown>;
}): Promise<void> {
  if (!isZohoCrmConfigured()) return;

  try {
    let contactId = data.zohoContactId;

    if (!contactId) {
      // Look up the cached Zoho Contact ID from our profiles table.
      // This avoids passing the ID through every call site.
      // Drizzle SELECT — projects only the one column we need, then limits
      // to 1 row. Array destructuring pulls the first (and only) result;
      // `profile` is undefined if no row matches.
      const [profile] = await db
        .select({ zohoContactId: profiles.zohoContactId })
        .from(profiles)
        .where(eq(profiles.id, data.profileId)) // WHERE profiles.id = $1
        .limit(1);
      contactId = profile?.zohoContactId ?? undefined;
    }

    // No contactId means the contact was never synced to Zoho — skip silently.
    if (!contactId) return;

    // PUT to /Contacts/:id — partial update, only the fields provided are
    // changed. Zoho leaves all other fields on the record untouched.
    await crmFetch(`/Contacts/${contactId}`, {
      method: "PUT",
      // Zoho expects an array even for a single record.
      body: { data: [data.fields] },
    });

    await logSync({
      status: "success",
      entityType: "crm_contact",
      localId: data.profileId,
      remoteId: contactId,
      message: `Updated contact fields: ${Object.keys(data.fields).join(", ")}`,
    });
  } catch (err) {
    Sentry.captureException(err);
    await logSync({
      status: "failed",
      entityType: "crm_contact",
      localId: data.profileId,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
