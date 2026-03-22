/**
 * actions.ts — Server actions for the admin Clients list view.
 *
 * ## Responsibility
 * Provides paginated client queries, loyalty leaderboard data, CRM mutations
 * (create / update / soft-delete), loyalty reward issuance, client preference
 * management, and an assistant-scoped "my clients" view.
 *
 * ## Consumers
 * - `app/dashboard/clients/page.tsx`       — admin clients table (getClients, getClientLoyalty)
 * - `app/dashboard/clients/client-*.tsx`    — modal forms (createClient, updateClient, deleteClient)
 * - `app/dashboard/clients/loyalty-*.tsx`   — loyalty tab (getClientLoyalty, issueLoyaltyReward)
 * - `app/dashboard/clients/preferences-*.tsx` — preferences drawer (getClientPreferences, upsertClientPreferences)
 * - `app/dashboard/assistant/clients/page.tsx` — assistant "my clients" view (getAssistantClients)
 *
 * ## Query strategy
 * `getClients` uses three LEFT JOIN subqueries (booking stats, loyalty stats,
 * referral stats) rather than raw joins to avoid row multiplication — a single
 * client with 20 bookings and 5 loyalty transactions would otherwise produce
 * 100 rows before aggregation.
 *
 * ## External integrations
 * Mutations do not sync to Square or Zoho directly. Profile fields like
 * `squareCustomerId` and `zohoContactId` are managed by background sync jobs
 * (see `lib/square/sync.ts` and `lib/zoho/sync.ts`). Mutations here only
 * update the local `profiles` table and fire PostHog + audit-log side-effects.
 *
 * ## Soft-delete pattern
 * `deleteClient` sets `isActive = false` rather than deleting the row, so
 * historical bookings, payments, and loyalty data remain intact for reporting.
 * All list queries filter on `isActive = true`.
 */
"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { and, eq, sql, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import { profiles, bookings, services, loyaltyTransactions, clientPreferences } from "@/db/schema";
import { logAction } from "@/lib/audit";
import { trackEvent } from "@/lib/posthog";
import { getUser } from "@/lib/auth";
import type {
  ClientSource,
  LifecycleStage,
  ClientRow,
  ClientInput,
  LoyaltyRow,
  PaginatedClients,
  ClientPreferencesRow,
  ClientPreferencesInput,
  AssistantClientRow,
  AssistantClientStats,
} from "@/lib/types/client.types";

/* ------------------------------------------------------------------ */
/*  Types — re-exported from lib/types/client.types                   */
/* ------------------------------------------------------------------ */

export type {
  ClientSource,
  LifecycleStage,
  ClientRow,
  ClientInput,
  LoyaltyRow,
  PaginatedClients,
  ClientPreferencesRow,
  ClientPreferencesInput,
  AssistantClientRow,
  AssistantClientStats,
} from "@/lib/types/client.types";

/* ------------------------------------------------------------------ */
/*  Queries — admin client list + loyalty leaderboard                  */
/* ------------------------------------------------------------------ */

/** Page size for the clients table. 100 keeps the initial payload under ~50 KB. */
const DEFAULT_CLIENTS_LIMIT = 100;

/**
 * Fetch a paginated list of active clients with booking stats, loyalty points,
 * and referral metadata. Called by the admin Clients table on mount and on
 * scroll (infinite pagination via offset).
 *
 * Uses limit + 1 to detect whether a next page exists without a separate COUNT.
 */
export async function getClients(opts?: {
  offset?: number;
  limit?: number;
}): Promise<PaginatedClients> {
  try {
    await getUser();

    const limit = opts?.limit ?? DEFAULT_CLIENTS_LIMIT;
    const offset = opts?.offset ?? 0;

    const referrer = alias(profiles, "referrer");

    // Subquery: aggregate all-time booking stats per client (intentionally unscoped by date)
    const bookingStats = db
      .select({
        clientId: bookings.clientId,
        totalBookings: sql<number>`count(*)`.as("total_bookings"),
        totalSpent: sql<number>`coalesce(sum(${bookings.totalInCents}), 0)`.as("total_spent"),
        lastVisit: sql<Date | null>`max(${bookings.startsAt})`.as("last_visit"),
      })
      .from(bookings)
      .groupBy(bookings.clientId)
      .as("booking_stats");

    // Subquery: aggregate loyalty points per client
    const loyaltyStats = db
      .select({
        profileId: loyaltyTransactions.profileId,
        points: sql<number>`coalesce(sum(${loyaltyTransactions.points}), 0)`.as("loyalty_points"),
      })
      .from(loyaltyTransactions)
      .groupBy(loyaltyTransactions.profileId)
      .as("loyalty_stats");

    // Subquery: count how many clients each person has referred
    const referee = alias(profiles, "referee");
    const referralStats = db
      .select({
        referrerId: referee.referredBy,
        referralCount: sql<number>`count(*)::int`.as("referral_count"),
      })
      .from(referee)
      .groupBy(referee.referredBy)
      .as("referral_stats");

    const rows = await db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        email: profiles.email,
        phone: profiles.phone,
        source: profiles.source,
        isVip: profiles.isVip,
        lifecycleStage: profiles.lifecycleStage,
        internalNotes: profiles.internalNotes,
        tags: profiles.tags,
        referredByName: referrer.firstName,
        referralCount: referralStats.referralCount,
        createdAt: profiles.createdAt,
        totalBookings: bookingStats.totalBookings,
        totalSpent: bookingStats.totalSpent,
        lastVisit: bookingStats.lastVisit,
        loyaltyPoints: loyaltyStats.points,
      })
      .from(profiles)
      .where(and(eq(profiles.role, "client"), eq(profiles.isActive, true)))
      .leftJoin(referrer, eq(profiles.referredBy, referrer.id))
      .leftJoin(bookingStats, eq(profiles.id, bookingStats.clientId))
      .leftJoin(loyaltyStats, eq(profiles.id, loyaltyStats.profileId))
      .leftJoin(referralStats, eq(profiles.id, referralStats.referrerId))
      .orderBy(desc(profiles.createdAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      // Spread each row and coerce SQL aggregate values (returned as strings
      // by Postgres) to Numbers. Spread is preferred over manual field listing
      // since the row has 17+ fields — only the 4 aggregates need coercion.
      rows: page.map((r) => ({
        ...r,
        lifecycleStage: (r.lifecycleStage as LifecycleStage | null) ?? null,
        totalBookings: Number(r.totalBookings ?? 0),
        totalSpent: Number(r.totalSpent ?? 0),
        loyaltyPoints: Number(r.loyaltyPoints ?? 0),
        referralCount: Number(r.referralCount ?? 0),
      })),
      hasMore,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Fetch loyalty point totals per active client for the Loyalty leaderboard tab.
 * Sorted by points descending so highest-value clients appear first.
 * Capped at 500 rows — enough for any realistic client base.
 */
export async function getClientLoyalty(): Promise<LoyaltyRow[]> {
  try {
    await getUser();

    const rows = await db
      .select({
        id: profiles.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        points: sql<number>`coalesce(sum(${loyaltyTransactions.points}), 0)`.as("points"),
        lastActivity: sql<Date | null>`max(${loyaltyTransactions.createdAt})`.as("last_activity"),
      })
      .from(profiles)
      .where(and(eq(profiles.role, "client"), eq(profiles.isActive, true)))
      .leftJoin(loyaltyTransactions, eq(profiles.id, loyaltyTransactions.profileId))
      .groupBy(profiles.id, profiles.firstName, profiles.lastName)
      .orderBy(sql`coalesce(sum(${loyaltyTransactions.points}), 0) desc`)
      .limit(500);

    // Spread each row and coerce the Postgres sum() result (string) to Number.
    // .map() gives a 1:1 conversion — every profile becomes one leaderboard entry.
    return rows.map((r) => ({
      ...r,
      points: Number(r.points ?? 0),
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Zod schemas — runtime validation for all mutation inputs           */
/* ------------------------------------------------------------------ */

/** Validates admin client create/update form payload before DB write. */
const clientInputSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  source: z
    .enum([
      "instagram",
      "tiktok",
      "pinterest",
      "word_of_mouth",
      "google_search",
      "referral",
      "website_direct",
      "event",
    ])
    .optional(),
  isVip: z.boolean(),
  lifecycleStage: z
    .enum(["prospect", "active", "at_risk", "lapsed", "churned"])
    .nullable()
    .optional(),
  internalNotes: z.string().optional(),
  tags: z.string().optional(),
});

/**
 * Validates the beauty/health preferences form. All fields optional because
 * preferences are filled incrementally across visits — the first visit may
 * only capture lash style, with retention and adhesive notes added later.
 */
const clientPreferencesInputSchema = z.object({
  profileId: z.string().min(1),
  preferredLashStyle: z.string().optional(),
  preferredCurlType: z.string().optional(),
  preferredLengths: z.string().optional(),
  preferredDiameter: z.string().optional(),
  naturalLashNotes: z.string().optional(),
  retentionProfile: z.string().optional(),
  allergies: z.string().optional(),
  skinType: z.string().optional(),
  adhesiveSensitivity: z.boolean().optional(),
  healthNotes: z.string().optional(),
  birthday: z.string().optional(),
  preferredContactMethod: z.string().optional(),
  preferredServiceTypes: z.string().optional(),
  generalNotes: z.string().optional(),
  preferredRebookIntervalDays: z.number().int().nonnegative().optional(),
});

/* ------------------------------------------------------------------ */
/*  Mutations — CRM write operations (admin only)                      */
/* ------------------------------------------------------------------ */

/**
 * Create a new client profile from the admin "Add Client" modal.
 *
 * Admin-created clients get a `profiles` row directly (bypassing Supabase Auth
 * signup) because they may never log in — they're CRM-only contacts. If they
 * later sign up via the public onboarding flow, the existing row is linked by
 * email match in `saveOnboardingData`.
 *
 * Side-effects: PostHog event, audit log entry, Next.js cache revalidation.
 */
export async function createClient(input: ClientInput): Promise<void> {
  try {
    clientInputSchema.parse(input);
    const user = await getUser();

    // Create a Supabase auth user first, then the profile
    // For admin-created clients we insert directly into profiles
    // (the Supabase trigger creates a minimal row on auth signup,
    //  but admin-created clients bypass auth — they just get a profile row)
    await db.insert(profiles).values({
      id: crypto.randomUUID(),
      role: "client",
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone ?? null,
      source: input.source ?? null,
      isVip: input.isVip,
      lifecycleStage: input.lifecycleStage ?? null,
      internalNotes: input.internalNotes ?? null,
      tags: input.tags ?? null,
    });

    trackEvent(user.id, "client_created", { source: input.source ?? null, isVip: input.isVip });

    await logAction({
      actorId: user.id,
      action: "create",
      entityType: "client",
      entityId: "new",
      description: "Client created",
      metadata: { email: input.email, source: input.source ?? null },
    });

    revalidatePath("/dashboard/clients");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Update an existing client profile from the admin "Edit Client" modal.
 * Only CRM-relevant fields are writable here — auth fields (password, role)
 * are managed separately.
 */
export async function updateClient(id: string, input: ClientInput): Promise<void> {
  try {
    z.string().min(1).parse(id);
    clientInputSchema.parse(input);
    const user = await getUser();

    await db
      .update(profiles)
      .set({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone ?? null,
        source: input.source ?? null,
        isVip: input.isVip,
        lifecycleStage: input.lifecycleStage ?? null,
        internalNotes: input.internalNotes ?? null,
        tags: input.tags ?? null,
      })
      .where(eq(profiles.id, id));

    trackEvent(user.id, "client_updated", { clientId: id, isVip: input.isVip });

    await logAction({
      actorId: user.id,
      action: "update",
      entityType: "client",
      entityId: id,
      description: "Client updated",
      metadata: { isVip: input.isVip },
    });

    revalidatePath("/dashboard/clients");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Soft-delete a client by setting `isActive = false`.
 * Hard deletes are intentionally avoided so historical booking/payment data
 * remains intact for financial reporting and audit trails.
 */
export async function deleteClient(id: string): Promise<void> {
  try {
    z.string().min(1).parse(id);
    const user = await getUser();
    await db.update(profiles).set({ isActive: false }).where(eq(profiles.id, id));
    trackEvent(user.id, "client_deleted", { clientId: id });

    await logAction({
      actorId: user.id,
      action: "delete",
      entityType: "client",
      entityId: id,
      description: "Client soft-deleted",
    });

    revalidatePath("/dashboard/clients");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Manually credit loyalty points to a client (admin "Issue Reward" action).
 * Inserts a `manual_credit` transaction — distinct from booking-driven credits
 * so the loyalty ledger audit trail shows the admin origin.
 */
export async function issueLoyaltyReward(
  profileId: string,
  points: number,
  description: string,
): Promise<void> {
  try {
    z.string().min(1).parse(profileId);
    z.number().int().positive().parse(points);
    z.string().min(1).parse(description);
    const user = await getUser();

    await db.insert(loyaltyTransactions).values({
      profileId,
      points,
      type: "manual_credit",
      description,
    });

    trackEvent(user.id, "loyalty_reward_issued", { clientId: profileId, points });

    revalidatePath("/dashboard/clients");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Client Preferences — beauty/health profile per client              */
/* ------------------------------------------------------------------ */

/**
 * Lash-tech-specific preferences stored in `client_preferences`.
 * Separated from the main profile because these are service-domain data
 * (curl types, adhesive sensitivity) rather than CRM contact data.
 */

/**
 * Fetch the beauty/health preferences for a single client.
 * Returns null when no row exists yet (new client, preferences not yet captured).
 * Called by the preferences drawer on the client detail page.
 */
export async function getClientPreferences(
  profileId: string,
): Promise<ClientPreferencesRow | null> {
  try {
    await getUser();
    const [row] = await db
      .select()
      .from(clientPreferences)
      .where(eq(clientPreferences.profileId, profileId))
      .limit(1);
    if (!row) return null;
    return {
      profileId: row.profileId,
      preferredLashStyle: row.preferredLashStyle,
      preferredCurlType: row.preferredCurlType,
      preferredLengths: row.preferredLengths,
      preferredDiameter: row.preferredDiameter,
      naturalLashNotes: row.naturalLashNotes,
      retentionProfile: row.retentionProfile,
      allergies: row.allergies,
      skinType: row.skinType,
      adhesiveSensitivity: row.adhesiveSensitivity,
      healthNotes: row.healthNotes,
      birthday: row.birthday,
      preferredContactMethod: row.preferredContactMethod,
      preferredServiceTypes: row.preferredServiceTypes,
      generalNotes: row.generalNotes,
      preferredRebookIntervalDays: row.preferredRebookIntervalDays,
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Create or update beauty/health preferences for a client.
 * Uses INSERT ... ON CONFLICT DO UPDATE keyed on `profileId` so the first save
 * creates the row and subsequent saves overwrite it without requiring the caller
 * to know whether a row already exists.
 */
export async function upsertClientPreferences(input: ClientPreferencesInput): Promise<void> {
  try {
    clientPreferencesInputSchema.parse(input);
    await getUser();

    const values = {
      profileId: input.profileId,
      preferredLashStyle: input.preferredLashStyle ?? null,
      preferredCurlType: input.preferredCurlType ?? null,
      preferredLengths: input.preferredLengths ?? null,
      preferredDiameter: input.preferredDiameter ?? null,
      naturalLashNotes: input.naturalLashNotes ?? null,
      retentionProfile: input.retentionProfile ?? null,
      allergies: input.allergies ?? null,
      skinType: input.skinType ?? null,
      adhesiveSensitivity: input.adhesiveSensitivity ?? false,
      healthNotes: input.healthNotes ?? null,
      birthday: input.birthday ?? null,
      preferredContactMethod: input.preferredContactMethod ?? null,
      preferredServiceTypes: input.preferredServiceTypes ?? null,
      generalNotes: input.generalNotes ?? null,
      preferredRebookIntervalDays: input.preferredRebookIntervalDays ?? null,
    };

    await db
      .insert(clientPreferences)
      .values(values)
      .onConflictDoUpdate({
        target: clientPreferences.profileId,
        // Spread the full values object then override profileId to undefined,
        // which Drizzle interprets as "do not update this column". This reuses
        // the same values object for both insert and update without duplicating
        // the 15 field assignments.
        set: {
          ...values,
          profileId: undefined,
        },
      });

    revalidatePath("/dashboard/clients");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Assistant-scoped clients — "My Clients" view for staff members     */
/* ------------------------------------------------------------------ */

/**
 * Row shape for the assistant's "My Clients" view. Unlike admin `ClientRow`,
 * this is scoped to clients the logged-in assistant has served — derived
 * from bookings rather than the full profiles table.
 * Name is privacy-truncated ("Sarah L.") since assistants don't need full names.
 */

/** Avatar fallback — "SL" for "Sarah Lee", "?" if both names are empty. */
function getInitials(first: string, last: string): string {
  return [first?.[0], last?.[0]].filter(Boolean).join("").toUpperCase() || "?";
}

/** Relative date for the "last service" column — shows "Today" or "Mar 15". */
function formatShortDate(d: Date): string {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const dKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  if (todayKey === dKey) return "Today";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Human-friendly appointment label — "Today 2:30 PM" or "Mar 15 2:30 PM". */
function formatApptLabel(d: Date): string {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const dKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  if (todayKey === dKey) return `Today ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
}

/**
 * Fetch the logged-in assistant's client list, derived from their bookings.
 *
 * Unlike `getClients` (which queries profiles directly), this starts from
 * the `bookings` table filtered by `staffId = currentUser` and groups by
 * client. This means an assistant only sees clients they've personally served,
 * providing a privacy boundary between staff members.
 *
 * The in-memory grouping approach (vs. SQL GROUP BY) is used because we need
 * to track both the latest completed booking AND the next upcoming booking
 * per client — two different aggregation passes that would require complex
 * window functions in SQL.
 *
 * Sort order: clients with upcoming appointments first (actionable), then
 * by last-visit date descending (recently seen clients stay near the top).
 */
export async function getAssistantClients(): Promise<{
  clients: AssistantClientRow[];
  stats: AssistantClientStats;
}> {
  try {
    const user = await getUser();
    const now = new Date();

    // Fetch all bookings for this assistant, joined with client profile + service
    const clientProfile = alias(profiles, "client");

    const rows = await db
      .select({
        bookingId: bookings.id,
        status: bookings.status,
        startsAt: bookings.startsAt,
        totalInCents: bookings.totalInCents,
        clientId: bookings.clientId,
        clientFirstName: clientProfile.firstName,
        clientLastName: clientProfile.lastName,
        clientEmail: clientProfile.email,
        clientPhone: clientProfile.phone,
        clientIsVip: clientProfile.isVip,
        clientNotes: clientProfile.internalNotes,
        serviceName: services.name,
        serviceCategory: services.category,
      })
      .from(bookings)
      .innerJoin(clientProfile, eq(bookings.clientId, clientProfile.id))
      .innerJoin(services, eq(bookings.serviceId, services.id))
      .where(eq(bookings.staffId, user.id))
      .orderBy(desc(bookings.startsAt));

    // Group by client
    const clientMap = new Map<
      string,
      {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string | null;
        isVip: boolean;
        notes: string | null;
        categories: Set<string>;
        completedVisits: number;
        completedSpent: number;
        lastCompletedAt: Date | null;
        lastCompletedService: string | null;
        nextUpcomingAt: Date | null;
      }
    >();

    for (const r of rows) {
      let entry = clientMap.get(r.clientId);
      if (!entry) {
        entry = {
          id: r.clientId,
          firstName: r.clientFirstName ?? "",
          lastName: r.clientLastName ?? "",
          email: r.clientEmail,
          phone: r.clientPhone,
          isVip: r.clientIsVip,
          notes: r.clientNotes,
          categories: new Set(),
          completedVisits: 0,
          completedSpent: 0,
          lastCompletedAt: null,
          lastCompletedService: null,
          nextUpcomingAt: null,
        };
        clientMap.set(r.clientId, entry);
      }

      if (r.serviceCategory) entry.categories.add(r.serviceCategory);

      if (r.status === "completed") {
        entry.completedVisits++;
        entry.completedSpent += r.totalInCents;
        const d = new Date(r.startsAt);
        if (!entry.lastCompletedAt || d > entry.lastCompletedAt) {
          entry.lastCompletedAt = d;
          entry.lastCompletedService = r.serviceName;
        }
      }

      // Track next upcoming (confirmed/pending/in_progress, in the future)
      if (["confirmed", "pending", "in_progress"].includes(r.status)) {
        const d = new Date(r.startsAt);
        if (d >= now && (!entry.nextUpcomingAt || d < entry.nextUpcomingAt)) {
          entry.nextUpcomingAt = d;
        }
      }
    }

    // Array.from converts the Map's values iterator into a sortable array.
    // Map preserves insertion order but we need a custom sort: clients with
    // upcoming appointments first (actionable), then by last visit descending.
    // .sort() mutates the array in place — acceptable here since Array.from
    // already created a new array.
    const clients: AssistantClientRow[] = Array.from(clientMap.values())
      .sort((a, b) => {
        // Sort: clients with upcoming appointments first, then by last visit desc
        if (a.nextUpcomingAt && !b.nextUpcomingAt) return -1;
        if (!a.nextUpcomingAt && b.nextUpcomingAt) return 1;
        const aLast = a.lastCompletedAt?.getTime() ?? 0;
        const bLast = b.lastCompletedAt?.getTime() ?? 0;
        return bLast - aLast;
      })
      // Transform each grouped client entry into the presentation-ready
      // AssistantClientRow shape: privacy-truncate names, convert cents→dollars,
      // convert Set→Array for categories, and format dates.
      .map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName.charAt(0)}.`.trim(),
        initials: getInitials(c.firstName, c.lastName),
        phone: c.phone,
        email: c.email,
        lastService: c.lastCompletedService,
        lastServiceDate: c.lastCompletedAt ? formatShortDate(c.lastCompletedAt) : null,
        // Array.from converts the Set<string> to a plain array for serialization
        // across the server-action boundary (Sets aren't JSON-serializable).
        categories: Array.from(c.categories),
        totalVisits: c.completedVisits,
        totalSpent: c.completedSpent / 100,
        vip: c.isVip,
        notes: c.notes,
        nextAppointment: c.nextUpcomingAt ? formatApptLabel(c.nextUpcomingAt) : null,
      }));

    // Count VIP clients via filter — cleaner than a reduce counter for
    // a simple boolean predicate.
    const vipClients = clients.filter((c) => c.vip).length;
    // Sum total revenue across all clients. reduce accumulates a running
    // total in a single pass — the standard pattern for scalar aggregation.
    const totalRevenue = clients.reduce((s, c) => s + c.totalSpent, 0);

    return {
      clients,
      stats: {
        totalClients: clients.length,
        vipClients,
        totalRevenue,
      },
    };
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
