"use server";

import { revalidatePath } from "next/cache";
import { eq, sql, desc } from "drizzle-orm";
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
  | "website_direct";

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
