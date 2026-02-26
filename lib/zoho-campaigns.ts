/**
 * Zoho Campaigns server-side client — subscriber sync for email marketing.
 *
 * Manages the mailing list that powers marketing emails (promos, seasonal,
 * re-engagement, birthday offers). Templates and scheduling are handled
 * inside the Zoho Campaigns UI — this module only syncs subscriber data.
 *
 * Graceful degradation: when ZOHO_CAMPAIGNS_LIST_KEY is missing, all
 * functions are no-ops so the app still boots without Campaigns.
 *
 * @module lib/zoho-campaigns
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, syncLog } from "@/db/schema";
import { isZohoAuthConfigured, getZohoAccessToken } from "@/lib/zoho-auth";

/* ------------------------------------------------------------------ */
/*  Configuration                                                      */
/* ------------------------------------------------------------------ */

const listKey = process.env.ZOHO_CAMPAIGNS_LIST_KEY;

/** Whether Zoho Campaigns integration is fully configured. */
export function isZohoCampaignsConfigured(): boolean {
  return isZohoAuthConfigured() && !!listKey;
}

/* ------------------------------------------------------------------ */
/*  Low-level API helper                                               */
/* ------------------------------------------------------------------ */

/**
 * Zoho Campaigns API uses a different base URL and response format
 * from Zoho CRM. Most endpoints accept form-encoded params with
 * `resfmt=JSON` and return `{ status, message, code }`.
 */
async function campaignsFetch(
  path: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const token = await getZohoAccessToken();

  const body = new URLSearchParams({ ...params, resfmt: "JSON" });

  const res = await fetch(`https://campaigns.zoho.com/api/v1.1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho Campaigns ${path} failed (${res.status}): ${text}`);
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

export type CampaignsSubscriberData = {
  profileId: string;
  email: string;
  firstName: string;
  lastName?: string;
  isVip?: boolean;
  source?: string | null;
  tags?: string | null;
  interests?: string;
  birthday?: string;
};

/**
 * Add or update a subscriber in the Zoho Campaigns mailing list.
 * Stores the returned contact key in `profiles.zohoCampaignsContactKey`.
 *
 * Only call when `notifyMarketing === true` — the caller is responsible
 * for checking the opt-in preference.
 */
export async function syncCampaignsSubscriber(data: CampaignsSubscriberData): Promise<void> {
  if (!isZohoCampaignsConfigured()) return;

  try {
    const contactInfo = JSON.stringify({
      "Contact Email": data.email,
      "First Name": data.firstName,
      "Last Name": data.lastName || data.firstName,
      ...(data.isVip != null ? { VIP: data.isVip ? "true" : "false" } : {}),
      ...(data.source ? { Source: data.source } : {}),
      ...(data.tags ? { Tags: data.tags } : {}),
      ...(data.interests ? { Interests: data.interests } : {}),
      ...(data.birthday ? { Birthday: data.birthday } : {}),
    });

    const result = await campaignsFetch("/json/listsubscribe", {
      listkey: listKey!,
      contactinfo: contactInfo,
    });

    // Zoho Campaigns returns { status: "success", message: "...", code: ... }
    const contactKey =
      typeof result.status === "string" && result.status === "success"
        ? (result.message as string) || undefined
        : undefined;

    if (contactKey) {
      await db
        .update(profiles)
        .set({ zohoCampaignsContactKey: contactKey })
        .where(eq(profiles.id, data.profileId));
    }

    await logSync({
      status: "success",
      entityType: "campaigns_subscriber",
      localId: data.profileId,
      remoteId: contactKey,
      message: `Synced subscriber ${data.email}`,
    });
  } catch (err) {
    console.error("[zoho-campaigns] Failed to sync subscriber:", err);
    await logSync({
      status: "failed",
      entityType: "campaigns_subscriber",
      localId: data.profileId,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

/**
 * Unsubscribe a contact from the Zoho Campaigns mailing list.
 * Call when `notifyMarketing` is toggled off.
 */
export async function unsubscribeFromCampaigns(profileId: string): Promise<void> {
  if (!isZohoCampaignsConfigured()) return;

  try {
    const [profile] = await db
      .select({
        email: profiles.email,
        zohoCampaignsContactKey: profiles.zohoCampaignsContactKey,
      })
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);

    if (!profile?.email) return;

    const contactInfo = JSON.stringify({ "Contact Email": profile.email });

    await campaignsFetch("/json/listunsubscribe", {
      listkey: listKey!,
      contactinfo: contactInfo,
    });

    await logSync({
      status: "success",
      entityType: "campaigns_unsubscribe",
      localId: profileId,
      message: `Unsubscribed ${profile.email}`,
    });
  } catch (err) {
    console.error("[zoho-campaigns] Failed to unsubscribe:", err);
    await logSync({
      status: "failed",
      entityType: "campaigns_unsubscribe",
      localId: profileId,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
