"use server";

import { revalidatePath } from "next/cache";
import { eq, ne, sql, and, gte } from "drizzle-orm";
import { db } from "@/db";
import { profiles, assistantProfiles, businessHours, bookings } from "@/db/schema";
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

export type AssistantRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  title: string | null;
  specialties: string | null;
  bio: string | null;
  averageRating: string | null;
  isAvailable: boolean;
  startDate: Date | null;
  totalSessions: number;
  totalRevenue: number;
  thisMonthSessions: number;
};

export type AssistantInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string;
  specialties?: string;
};

export type AvailabilityRow = {
  staffId: string;
  staffName: string;
  dayOfWeek: number;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
};

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

export async function getAssistants(): Promise<AssistantRow[]> {
  await getUser();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Subquery: total booking stats per staff
  const allBookingStats = db
    .select({
      staffId: bookings.staffId,
      totalSessions: sql<number>`count(*)`.as("total_sessions"),
      totalRevenue: sql<number>`coalesce(sum(${bookings.totalInCents}), 0)`.as("total_revenue"),
    })
    .from(bookings)
    .groupBy(bookings.staffId)
    .as("all_booking_stats");

  // Subquery: this month's sessions per staff
  const monthBookingStats = db
    .select({
      staffId: bookings.staffId,
      thisMonthSessions: sql<number>`count(*)`.as("this_month_sessions"),
    })
    .from(bookings)
    .where(gte(bookings.startsAt, startOfMonth))
    .groupBy(bookings.staffId)
    .as("month_booking_stats");

  const rows = await db
    .select({
      id: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      email: profiles.email,
      phone: profiles.phone,
      isActive: profiles.isActive,
      title: assistantProfiles.title,
      specialties: assistantProfiles.specialties,
      bio: assistantProfiles.bio,
      averageRating: assistantProfiles.averageRating,
      isAvailable: assistantProfiles.isAvailable,
      startDate: assistantProfiles.startDate,
      totalSessions: allBookingStats.totalSessions,
      totalRevenue: allBookingStats.totalRevenue,
      thisMonthSessions: monthBookingStats.thisMonthSessions,
    })
    .from(profiles)
    .where(ne(profiles.role, "client"))
    .leftJoin(assistantProfiles, eq(profiles.id, assistantProfiles.profileId))
    .leftJoin(allBookingStats, eq(profiles.id, allBookingStats.staffId))
    .leftJoin(monthBookingStats, eq(profiles.id, monthBookingStats.staffId))
    .orderBy(profiles.firstName);

  return rows.map((r) => ({
    ...r,
    isAvailable: r.isAvailable ?? true,
    totalSessions: Number(r.totalSessions ?? 0),
    totalRevenue: Number(r.totalRevenue ?? 0),
    thisMonthSessions: Number(r.thisMonthSessions ?? 0),
  }));
}

export async function getAssistantAvailability(): Promise<AvailabilityRow[]> {
  await getUser();

  const rows = await db
    .select({
      staffId: businessHours.staffId,
      staffFirstName: profiles.firstName,
      staffLastName: profiles.lastName,
      dayOfWeek: businessHours.dayOfWeek,
      isOpen: businessHours.isOpen,
      opensAt: businessHours.opensAt,
      closesAt: businessHours.closesAt,
    })
    .from(businessHours)
    .innerJoin(profiles, eq(businessHours.staffId, profiles.id))
    .orderBy(profiles.firstName, businessHours.dayOfWeek);

  return rows.map((r) => ({
    staffId: r.staffId!,
    staffName: [r.staffFirstName, r.staffLastName].filter(Boolean).join(" "),
    dayOfWeek: r.dayOfWeek,
    isOpen: r.isOpen,
    opensAt: r.opensAt,
    closesAt: r.closesAt,
  }));
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                          */
/* ------------------------------------------------------------------ */

export async function createAssistant(input: AssistantInput): Promise<void> {
  await getUser();

  const id = crypto.randomUUID();

  await db.insert(profiles).values({
    id,
    role: "assistant",
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone ?? null,
  });

  await db.insert(assistantProfiles).values({
    profileId: id,
    title: input.title ?? null,
    specialties: input.specialties ?? null,
    isAvailable: true,
    startDate: new Date(),
  });

  revalidatePath("/dashboard/assistants");
}

export async function updateAssistant(id: string, input: AssistantInput): Promise<void> {
  await getUser();

  await db
    .update(profiles)
    .set({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone ?? null,
    })
    .where(eq(profiles.id, id));

  // Upsert assistant_profiles — may not exist for admin users
  const existing = await db
    .select({ profileId: assistantProfiles.profileId })
    .from(assistantProfiles)
    .where(eq(assistantProfiles.profileId, id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(assistantProfiles)
      .set({
        title: input.title ?? null,
        specialties: input.specialties ?? null,
      })
      .where(eq(assistantProfiles.profileId, id));
  } else {
    await db.insert(assistantProfiles).values({
      profileId: id,
      title: input.title ?? null,
      specialties: input.specialties ?? null,
    });
  }

  revalidatePath("/dashboard/assistants");
}

export async function toggleAssistantStatus(
  id: string,
  status: "active" | "on_leave" | "inactive",
): Promise<void> {
  await getUser();

  if (status === "inactive") {
    await db.update(profiles).set({ isActive: false }).where(eq(profiles.id, id));
    // Also mark unavailable
    await db
      .update(assistantProfiles)
      .set({ isAvailable: false })
      .where(eq(assistantProfiles.profileId, id));
  } else if (status === "on_leave") {
    await db.update(profiles).set({ isActive: true }).where(eq(profiles.id, id));
    await db
      .update(assistantProfiles)
      .set({ isAvailable: false })
      .where(eq(assistantProfiles.profileId, id));
  } else {
    // active
    await db.update(profiles).set({ isActive: true }).where(eq(profiles.id, id));
    await db
      .update(assistantProfiles)
      .set({ isAvailable: true })
      .where(eq(assistantProfiles.profileId, id));
  }

  revalidatePath("/dashboard/assistants");
}

export async function deleteAssistant(id: string): Promise<void> {
  await getUser();
  await db.delete(profiles).where(eq(profiles.id, id));
  revalidatePath("/dashboard/assistants");
}
