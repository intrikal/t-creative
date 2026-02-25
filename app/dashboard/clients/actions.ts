"use server";

import { revalidatePath } from "next/cache";
import { eq, sql, desc, and, gte, asc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { profiles, bookings, services, loyaltyTransactions } from "@/db/schema";
import { createClient as createSupabaseClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

async function getUser() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ClientSource =
  | "instagram"
  | "tiktok"
  | "pinterest"
  | "word_of_mouth"
  | "google_search"
  | "referral"
  | "website_direct"
  | "event";

export type ClientRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  source: ClientSource | null;
  isVip: boolean;
  internalNotes: string | null;
  tags: string | null;
  referredByName: string | null;
  createdAt: Date;
  totalBookings: number;
  totalSpent: number;
  lastVisit: Date | null;
  loyaltyPoints: number;
};

export type ClientInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  source?: ClientSource;
  isVip: boolean;
  internalNotes?: string;
  tags?: string;
};

export type LoyaltyRow = {
  id: string;
  firstName: string;
  lastName: string;
  points: number;
  lastActivity: Date | null;
};

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

export async function getClients(): Promise<ClientRow[]> {
  await getUser();

  const referrer = alias(profiles, "referrer");

  // Subquery: aggregate booking stats per client
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

  const rows = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      phone: profiles.phone,
      source: profiles.source,
      isVip: profiles.isVip,
      internalNotes: profiles.internalNotes,
      tags: profiles.tags,
      referredByName: referrer.firstName,
      createdAt: profiles.createdAt,
      totalBookings: bookingStats.totalBookings,
      totalSpent: bookingStats.totalSpent,
      lastVisit: bookingStats.lastVisit,
      loyaltyPoints: loyaltyStats.points,
    })
    .from(profiles)
    .where(eq(profiles.role, "client"))
    .leftJoin(referrer, eq(profiles.referredBy, referrer.id))
    .leftJoin(bookingStats, eq(profiles.id, bookingStats.clientId))
    .leftJoin(loyaltyStats, eq(profiles.id, loyaltyStats.profileId))
    .orderBy(desc(profiles.createdAt));

  return rows.map((r) => ({
    ...r,
    totalBookings: Number(r.totalBookings ?? 0),
    totalSpent: Number(r.totalSpent ?? 0),
    loyaltyPoints: Number(r.loyaltyPoints ?? 0),
  }));
}

export async function getClientLoyalty(): Promise<LoyaltyRow[]> {
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
    .where(eq(profiles.role, "client"))
    .leftJoin(loyaltyTransactions, eq(profiles.id, loyaltyTransactions.profileId))
    .groupBy(profiles.id, profiles.firstName, profiles.lastName)
    .orderBy(sql`coalesce(sum(${loyaltyTransactions.points}), 0) desc`);

  return rows.map((r) => ({
    ...r,
    points: Number(r.points ?? 0),
  }));
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

export async function createClient(input: ClientInput): Promise<void> {
  await getUser();

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
    internalNotes: input.internalNotes ?? null,
    tags: input.tags ?? null,
  });

  revalidatePath("/dashboard/clients");
}

export async function updateClient(id: string, input: ClientInput): Promise<void> {
  await getUser();

  await db
    .update(profiles)
    .set({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone ?? null,
      source: input.source ?? null,
      isVip: input.isVip,
      internalNotes: input.internalNotes ?? null,
      tags: input.tags ?? null,
    })
    .where(eq(profiles.id, id));

  revalidatePath("/dashboard/clients");
}

export async function deleteClient(id: string): Promise<void> {
  await getUser();
  await db.delete(profiles).where(eq(profiles.id, id));
  revalidatePath("/dashboard/clients");
}

export async function issueLoyaltyReward(
  profileId: string,
  points: number,
  description: string,
): Promise<void> {
  await getUser();

  await db.insert(loyaltyTransactions).values({
    profileId,
    points,
    type: "manual_credit",
    description,
  });

  revalidatePath("/dashboard/clients");
}

/* ------------------------------------------------------------------ */
/*  Assistant-scoped clients                                           */
/* ------------------------------------------------------------------ */

export type AssistantClientRow = {
  id: string;
  name: string;
  initials: string;
  phone: string | null;
  email: string;
  lastService: string | null;
  lastServiceDate: string | null;
  categories: string[];
  totalVisits: number;
  totalSpent: number;
  vip: boolean;
  notes: string | null;
  nextAppointment: string | null;
};

export type AssistantClientStats = {
  totalClients: number;
  vipClients: number;
  totalRevenue: number;
};

function getInitials(first: string, last: string): string {
  return [first?.[0], last?.[0]].filter(Boolean).join("").toUpperCase() || "?";
}

function formatShortDate(d: Date): string {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const dKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  if (todayKey === dKey) return "Today";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatApptLabel(d: Date): string {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const dKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  if (todayKey === dKey) return `Today ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time}`;
}

export async function getAssistantClients(): Promise<{
  clients: AssistantClientRow[];
  stats: AssistantClientStats;
}> {
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

  const clients: AssistantClientRow[] = Array.from(clientMap.values())
    .sort((a, b) => {
      // Sort: clients with upcoming appointments first, then by last visit desc
      if (a.nextUpcomingAt && !b.nextUpcomingAt) return -1;
      if (!a.nextUpcomingAt && b.nextUpcomingAt) return 1;
      const aLast = a.lastCompletedAt?.getTime() ?? 0;
      const bLast = b.lastCompletedAt?.getTime() ?? 0;
      return bLast - aLast;
    })
    .map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName.charAt(0)}.`.trim(),
      initials: getInitials(c.firstName, c.lastName),
      phone: c.phone,
      email: c.email,
      lastService: c.lastCompletedService,
      lastServiceDate: c.lastCompletedAt ? formatShortDate(c.lastCompletedAt) : null,
      categories: Array.from(c.categories),
      totalVisits: c.completedVisits,
      totalSpent: c.completedSpent / 100,
      vip: c.isVip,
      notes: c.notes,
      nextAppointment: c.nextUpcomingAt ? formatApptLabel(c.nextUpcomingAt) : null,
    }));

  const vipClients = clients.filter((c) => c.vip).length;
  const totalRevenue = clients.reduce((s, c) => s + c.totalSpent, 0);

  return {
    clients,
    stats: {
      totalClients: clients.length,
      vipClients,
      totalRevenue,
    },
  };
}
