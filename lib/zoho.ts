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
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, bookings, syncLog } from "@/db/schema";

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

const clientId = process.env.ZOHO_CLIENT_ID;
const clientSecret = process.env.ZOHO_CLIENT_SECRET;
const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
const accountsUrl = "https://accounts.zoho.com";

/** Whether Zoho CRM integration is configured. */
export function isZohoConfigured(): boolean {
  return !!(clientId && clientSecret && refreshToken);
}

/* ------------------------------------------------------------------ */
/*  OAuth2 token management                                            */
/* ------------------------------------------------------------------ */

let _accessToken: string | null = null;
let _tokenExpiresAt = 0;

/**
 * Returns a valid access token, refreshing if expired.
 * Zoho access tokens last ~1 hour; the refresh token is long-lived.
 */
async function getAccessToken(): Promise<string> {
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

/* ------------------------------------------------------------------ */
/*  Low-level API helper                                               */
/* ------------------------------------------------------------------ */

async function zohoFetch(
  path: string,
  options: { method?: string; body?: Record<string, unknown> } = {},
): Promise<Record<string, unknown>> {
  const token = await getAccessToken();
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
      Last_Name: data.lastName || data.firstName,
    };
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
    console.error("[zoho] Failed to upsert contact:", err);
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

    // Store Zoho Deal ID on the booking if applicable
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
    console.error("[zoho] Failed to create deal:", err);
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
    console.error("[zoho] Failed to update deal:", err);
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
    console.error("[zoho] Failed to add note:", err);
    await logSync({
      status: "failed",
      entityType: "note",
      localId: profileId,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
