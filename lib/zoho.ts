/**
 * Zoho CRM server-side client — singleton for server actions and API routes.
 *
 * Graceful degradation: when ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET / ZOHO_REFRESH_TOKEN
 * are missing, all public functions are no-ops so the app still boots without Zoho.
 *
 * Uses the Zoho CRM v7 REST API directly via fetch (no SDK dependency).
 *
 * @module lib/zoho
 */
import * as Sentry from "@sentry/nextjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, bookings, syncLog } from "@/db/schema";
import { isZohoAuthConfigured, getZohoAccessToken } from "@/lib/zoho-auth";

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";

/** Whether Zoho CRM integration is configured. */
export function isZohoConfigured(): boolean {
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
async function zohoFetch(
  path: string,
  options: { method?: string; body?: Record<string, unknown> } = {},
): Promise<Record<string, unknown>> {
  const token = await getZohoAccessToken();
  const res = await fetch(`${apiDomain}/crm/v7${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho API ${options.method || "GET"} ${path} failed (${res.status}): ${text}`);
  }

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
  payload?: Record<string, unknown>;
}) {
  try {
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
 * Create or update a Zoho CRM Contact. Uses email as the dedup key via
 * Zoho's upsert endpoint. Stores the returned Zoho Contact ID back to
 * our `profiles.zohoContactId` column.
 */
export async function upsertZohoContact(data: {
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
  if (!isZohoConfigured()) return;

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

    const result = await zohoFetch("/Contacts/upsert", {
      method: "POST",
      body: {
        data: [contactData],
        duplicate_check_fields: ["Email"],
      },
    });

    // Extract Zoho Contact ID from response
    const details = result.data as
      | Array<{ details?: { id?: string }; status?: string }>
      | undefined;
    const zohoContactId = details?.[0]?.details?.id;

    if (zohoContactId) {
      await db.update(profiles).set({ zohoContactId }).where(eq(profiles.id, data.profileId));
    }

    await logSync({
      status: "success",
      entityType: "contact",
      localId: data.profileId,
      remoteId: zohoContactId,
      message: `Upserted contact ${data.email}`,
    });
  } catch (err) {
    Sentry.captureException(err);
    await logSync({
      status: "failed",
      entityType: "contact",
      localId: data.profileId,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

/**
 * Create a Zoho CRM Deal linked to a Contact. Used for bookings,
 * orders, and training enrollments. Stores the Zoho Deal ID back
 * to `bookings.zohoProjectId` when a bookingId is provided.
 */
export async function createZohoDeal(data: {
  contactEmail: string;
  dealName: string;
  stage: string;
  amountInCents?: number;
  pipeline?: string;
  bookingId?: number;
  externalId?: string;
}): Promise<void> {
  if (!isZohoConfigured()) return;

  try {
    // Look up the Zoho Contact ID by email
    const [profile] = await db
      .select({ zohoContactId: profiles.zohoContactId })
      .from(profiles)
      .where(eq(profiles.email, data.contactEmail))
      .limit(1);

    const dealData: Record<string, unknown> = {
      Deal_Name: data.dealName,
      Stage: data.stage,
    };
    // Zoho Deals store amounts in dollars — convert from our cents-based system.
    if (data.amountInCents != null) dealData.Amount = data.amountInCents / 100;
    if (data.pipeline) dealData.Pipeline = data.pipeline;
    if (profile?.zohoContactId) {
      dealData.Contact_Name = { id: profile.zohoContactId };
    }

    const result = await zohoFetch("/Deals", {
      method: "POST",
      body: { data: [dealData] },
    });

    const details = result.data as Array<{ details?: { id?: string } }> | undefined;
    const zohoDealId = details?.[0]?.details?.id;

    // Store Zoho Deal ID on the booking so `updateZohoDeal` can
    // later update the deal stage without another lookup.
    if (zohoDealId && data.bookingId) {
      await db
        .update(bookings)
        .set({ zohoProjectId: zohoDealId })
        .where(eq(bookings.id, data.bookingId));
    }

    await logSync({
      status: "success",
      entityType: "deal",
      localId: data.bookingId?.toString() || data.externalId,
      remoteId: zohoDealId,
      message: `Created deal: ${data.dealName}`,
    });
  } catch (err) {
    Sentry.captureException(err);
    await logSync({
      status: "failed",
      entityType: "deal",
      localId: data.bookingId?.toString() || data.externalId,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

/**
 * Update a Zoho CRM Deal stage (e.g. completed → Closed Won).
 * Looks up the `zohoProjectId` from the booking row.
 */
export async function updateZohoDeal(bookingId: number, stage: string): Promise<void> {
  if (!isZohoConfigured()) return;

  try {
    const [booking] = await db
      .select({ zohoProjectId: bookings.zohoProjectId })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking?.zohoProjectId) return;

    await zohoFetch(`/Deals/${booking.zohoProjectId}`, {
      method: "PUT",
      body: {
        data: [{ Stage: stage }],
      },
    });

    await logSync({
      status: "success",
      entityType: "deal",
      localId: String(bookingId),
      remoteId: booking.zohoProjectId,
      message: `Updated deal stage to ${stage}`,
    });
  } catch (err) {
    Sentry.captureException(err);
    await logSync({
      status: "failed",
      entityType: "deal",
      localId: String(bookingId),
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

/**
 * Add a Note to a Zoho CRM Contact. Used for reviews, cancellations,
 * and other notable client interactions.
 */
export async function logZohoNote(
  profileId: string,
  title: string,
  content: string,
): Promise<void> {
  if (!isZohoConfigured()) return;

  try {
    const [profile] = await db
      .select({ zohoContactId: profiles.zohoContactId })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);

    if (!profile?.zohoContactId) return;

    await zohoFetch("/Notes", {
      method: "POST",
      body: {
        data: [
          {
            Note_Title: title,
            Note_Content: content,
            Parent_Id: { module: { api_name: "Contacts" }, id: profile.zohoContactId },
            se_module: "Contacts",
          },
        ],
      },
    });

    await logSync({
      status: "success",
      entityType: "note",
      localId: profileId,
      remoteId: profile.zohoContactId,
      message: `Added note: ${title}`,
    });
  } catch (err) {
    Sentry.captureException(err);
    await logSync({
      status: "failed",
      entityType: "note",
      localId: profileId,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
