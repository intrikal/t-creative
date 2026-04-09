/**
 * Aftercare & studio policy server actions — admin CRUD for aftercare
 * instructions and studio policies.
 *
 * Both aftercare sections and studio policies live in the same `policies`
 * table, distinguished by the `type` column ("aftercare" vs "studio_policy").
 * Aftercare content is stored as a JSON string with `dos` and `donts` arrays.
 *
 * All actions require authentication. Mutations revalidate the dashboard
 * services and aftercare pages so the UI stays in sync.
 *
 * @module dashboard/aftercare/actions
 */
"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { eq, asc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { policies } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

import type {
  AftercareSection,
  PolicyEntry,
  AftercareSectionInput,
  PolicyInput,
} from "@/lib/types/aftercare.types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Aftercare content is stored as JSON: {"dos": [...], "donts": [...]} */
function parseAftercareContent(raw: string): { dos: string[]; donts: string[] } {
  try {
    const parsed = JSON.parse(raw);
    return {
      dos: Array.isArray(parsed.dos) ? parsed.dos : [],
      donts: Array.isArray(parsed.donts) ? parsed.donts : [],
    };
  } catch {
    return { dos: [], donts: [] };
  }
}

/* ------------------------------------------------------------------ */
/*  Queries                                                            */
/* ------------------------------------------------------------------ */

/**
 * Returns all aftercare sections for the admin dashboard.
 * Each section contains a title, category, and lists of dos/donts.
 */
export async function getAftercareSections(): Promise<AftercareSection[]> {
  try {
    await requireAdmin();

    // QUERY: Fetch every aftercare instruction section.
    // SELECT   — All columns from the policies table (id, title, content JSON, category, etc.).
    // FROM     — The policies table, which stores both aftercare sections and studio policies.
    // WHERE    — type = "aftercare" filters out studio policies, keeping only aftercare rows.
    // ORDER BY — Primary sort by sortOrder (admin-defined display order), secondary sort by id
    //            as a tiebreaker so rows with the same sortOrder appear in creation order.
    const rows = await db
      .select()
      .from(policies)
      .where(eq(policies.type, "aftercare"))
      .orderBy(asc(policies.sortOrder), asc(policies.id));

    // Transform each policy row into an AftercareSection by parsing the JSON
    // content column into separate dos/donts arrays. The DB stores them as a
    // single JSON string to keep the schema simple (one content column for both
    // aftercare and studio_policy types); we unpack here for the typed UI shape.
    return rows.map((r) => {
      const { dos, donts } = parseAftercareContent(r.content);
      return {
        id: r.id,
        title: r.title,
        category: r.category,
        dos,
        donts,
      };
    });
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Returns all studio policy entries for the admin dashboard.
 * Each entry has a title and free-text content (e.g. cancellation policy).
 */
export async function getPolicies(): Promise<PolicyEntry[]> {
  try {
    await requireAdmin();

    // QUERY: Fetch every studio policy entry.
    // SELECT   — All columns from the policies table.
    // FROM     — The policies table (shared with aftercare data).
    // WHERE    — type = "studio_policy" filters out aftercare rows, keeping only policies.
    // ORDER BY — Primary sort by sortOrder (admin-defined display order), secondary by id
    //            as a tiebreaker for rows sharing the same sortOrder value.
    const rows = await db
      .select()
      .from(policies)
      .where(eq(policies.type, "studio_policy"))
      .orderBy(asc(policies.sortOrder), asc(policies.id));

    // Extract only the fields the PolicyEntry type needs, dropping internal
    // columns (type, slug, sortOrder, category) that the admin UI doesn't display.
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
    }));
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Mutations — Aftercare sections                                     */
/* ------------------------------------------------------------------ */

const aftercareSectionInputSchema = z.object({
  title: z.string().min(1),
  category: z.string().optional(),
  dos: z.array(z.string()),
  donts: z.array(z.string()),
});

/**
 * Creates a new aftercare section and appends it to the end of the list.
 *
 * Side-effects:
 * - Inserts a row in the policies table with type "aftercare".
 * - Revalidates the services and aftercare dashboard pages so the new section appears.
 */
export async function createAftercareSection(input: AftercareSectionInput): Promise<void> {
  try {
    aftercareSectionInputSchema.parse(input);
    await requireAdmin();

    // QUERY: Read sortOrder values for all existing aftercare rows to determine
    // where the new section should appear in the list.
    // SELECT   — Only the sortOrder column (we just need the highest value).
    // FROM     — policies table.
    // WHERE    — type = "aftercare" so we don't count studio_policy rows.
    // ORDER BY — Ascending so the last element in the result array is the highest sortOrder.
    const maxSort = await db
      .select({ sortOrder: policies.sortOrder })
      .from(policies)
      .where(eq(policies.type, "aftercare"))
      .orderBy(asc(policies.sortOrder));

    const nextSort = maxSort.length > 0 ? maxSort[maxSort.length - 1].sortOrder + 1 : 0;

    // MUTATION: Insert the new aftercare section at the end of the sort order.
    // The content column stores dos/donts as a JSON string.
    // The slug is auto-generated from the title for URL-friendly identification.
    await db.insert(policies).values({
      type: "aftercare",
      slug: slugify(input.title) + "-aftercare",
      title: input.title,
      content: JSON.stringify({ dos: input.dos, donts: input.donts }),
      category: (input.category as "lash" | "jewelry" | "crochet" | "consulting") ?? null,
      sortOrder: nextSort,
    });

    // Side-effect: Purge cached pages so the new section shows immediately.
    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/aftercare");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Updates an existing aftercare section's title, category, dos, and donts.
 *
 * Side-effects:
 * - Overwrites the title, slug, content JSON, and category on the matching row.
 * - Revalidates the services and aftercare dashboard pages.
 */
export async function updateAftercareSection(
  id: number,
  input: AftercareSectionInput,
): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    aftercareSectionInputSchema.parse(input);
    await requireAdmin();

    // MUTATION: Update the aftercare row matching the given ID.
    // SET   — Overwrites title, slug (re-derived from new title), content JSON,
    //         and category. sortOrder is intentionally NOT changed here — use a
    //         separate reorder action if the admin wants to move it.
    // WHERE — Matches by primary key (policies.id).
    await db
      .update(policies)
      .set({
        title: input.title,
        slug: slugify(input.title) + "-aftercare",
        content: JSON.stringify({ dos: input.dos, donts: input.donts }),
        category: (input.category as "lash" | "jewelry" | "crochet" | "consulting") ?? null,
      })
      .where(eq(policies.id, id));

    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/aftercare");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Permanently deletes an aftercare section.
 *
 * Side-effects:
 * - Removes the row from the policies table. This is irreversible.
 * - Revalidates the services and aftercare dashboard pages.
 */
export async function deleteAftercareSection(id: number): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    await requireAdmin();
    // MUTATION: Delete the aftercare row by primary key.
    // WHERE — Matches policies.id. Only one row is affected.
    await db.delete(policies).where(eq(policies.id, id));
    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/aftercare");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Mutations — Studio policies                                        */
/* ------------------------------------------------------------------ */

const policyInputSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
});

/**
 * Creates a new studio policy and appends it to the end of the policy list.
 *
 * Side-effects:
 * - Inserts a row in the policies table with type "studio_policy".
 * - Revalidates the services and aftercare dashboard pages.
 */
export async function createPolicy(input: PolicyInput): Promise<void> {
  try {
    policyInputSchema.parse(input);
    await requireAdmin();

    // QUERY: Read sortOrder values for all existing studio_policy rows to find the max.
    // SELECT   — Only sortOrder.
    // FROM     — policies table.
    // WHERE    — type = "studio_policy" so aftercare rows are excluded.
    // ORDER BY — Ascending; the last element in the array holds the highest value.
    const maxSort = await db
      .select({ sortOrder: policies.sortOrder })
      .from(policies)
      .where(eq(policies.type, "studio_policy"))
      .orderBy(asc(policies.sortOrder));

    const nextSort = maxSort.length > 0 ? maxSort[maxSort.length - 1].sortOrder + 1 : 0;

    // MUTATION: Insert the new studio policy at the end of the sort order.
    // The slug is auto-generated from the title for URL-friendly identification.
    // Content is stored as plain text (unlike aftercare which uses JSON).
    await db.insert(policies).values({
      type: "studio_policy",
      slug: slugify(input.title) + "-policy",
      title: input.title,
      content: input.content,
      sortOrder: nextSort,
    });

    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/aftercare");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Updates an existing studio policy's title and content.
 *
 * Side-effects:
 * - Overwrites the title, slug, and content on the matching row.
 * - Revalidates the services and aftercare dashboard pages.
 */
export async function updatePolicy(id: number, input: PolicyInput): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    policyInputSchema.parse(input);
    await requireAdmin();

    // MUTATION: Update the studio policy row matching the given ID.
    // SET   — Overwrites title, slug (re-derived from new title), and content text.
    // WHERE — Matches by primary key (policies.id).
    await db
      .update(policies)
      .set({
        title: input.title,
        slug: slugify(input.title) + "-policy",
        content: input.content,
      })
      .where(eq(policies.id, id));

    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/aftercare");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/**
 * Permanently deletes a studio policy.
 *
 * Side-effects:
 * - Removes the row from the policies table. This is irreversible.
 * - Revalidates the services and aftercare dashboard pages.
 */
export async function deletePolicy(id: number): Promise<void> {
  try {
    z.number().int().positive().parse(id);
    await requireAdmin();
    // MUTATION: Delete the studio policy row by primary key.
    // WHERE — Matches policies.id. Only one row is affected.
    await db.delete(policies).where(eq(policies.id, id));
    revalidatePath("/dashboard/services");
    revalidatePath("/dashboard/aftercare");
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Seed — populate DB from hardcoded defaults (one-time)              */
/* ------------------------------------------------------------------ */

const DEFAULT_AFTERCARE: { title: string; category: string; dos: string[]; donts: string[] }[] = [
  {
    title: "Lash Extensions",
    category: "lash",
    dos: [
      "Keep lashes dry for the first 24–48 hours after your appointment.",
      "Cleanse lashes 3–4× per week with an oil-free lash cleanser.",
      "Brush lashes gently each morning with a clean spoolie.",
      "Sleep on your back or use a lash pillow to protect the shape.",
      "Book your fill every 2–3 weeks to maintain fullness.",
    ],
    donts: [
      "Do not use oil-based makeup removers or skincare near the eye area.",
      "Do not pick, pull, or rub your lashes — this causes premature shedding.",
      "Avoid steam rooms, saunas, or prolonged hot showers for 48 hours.",
      "Do not use a mechanical eyelash curler.",
      "Avoid waterproof mascara on extensions.",
    ],
  },
  {
    title: "Permanent Jewelry",
    category: "jewelry",
    dos: [
      "Your jewelry is safe to shower, swim, and sleep in — it's designed for everyday wear.",
      "Polish occasionally with a soft cloth to keep the shine.",
      "Visit the studio if the chain ever needs adjustment or re-welding.",
    ],
    donts: [
      "Avoid exposing to harsh chemicals like bleach, chlorine, or cleaning products.",
      "Do not apply lotions or perfumes directly onto the chain.",
      "Do not attempt to cut or remove at home — visit the studio for removal.",
    ],
  },
  {
    title: "Crochet & Braids",
    category: "crochet",
    dos: [
      "Moisturize your scalp with a lightweight oil 2–3× per week.",
      "Sleep with a satin bonnet or on a satin pillowcase to preserve style.",
      "Wash your style every 2–3 weeks using a diluted shampoo or co-wash.",
    ],
    donts: [
      "Do not leave crochet styles in longer than 8 weeks.",
      "Avoid excess moisture or product buildup on extensions.",
      "Do not scratch aggressively — use a rat-tail comb to relieve itching.",
    ],
  },
];

const DEFAULT_POLICIES: { title: string; content: string }[] = [
  {
    title: "Booking & Deposits",
    content: `All appointments require a non-refundable deposit at the time of booking. Deposits are applied toward your service total.\n\nDeposit amounts:\n• Lash services: $30\n• Permanent Jewelry: $20\n• Crochet installs: $40\n• Events & parties: 25% of total\n• Training programs: $100`,
  },
  {
    title: "Cancellation & Rescheduling",
    content: `We kindly ask for at least 48 hours notice for cancellations or rescheduling.\n\n• Cancellations with 48+ hours notice: Deposit transferred to rescheduled appointment.\n• Cancellations within 24 hours: Deposit is forfeited.\n• No-shows: Deposit is forfeited and a $25 no-show fee applies to future bookings.`,
  },
  {
    title: "Late Arrivals",
    content: `Please arrive on time or a few minutes early for your appointment.\n\n• Up to 10 minutes late: We will do our best to accommodate your full service.\n• 10–20 minutes late: Your service may be modified to fit the remaining time.\n• 20+ minutes late: Your appointment may be forfeited and your deposit may not be refunded.`,
  },
  {
    title: "Health & Sensitivity",
    content: `Your health and safety are our top priority.\n\n• Please disclose any known allergies or sensitivities during booking.\n• If you experience irritation or an allergic reaction, contact us immediately.\n• Patch tests are available upon request for new clients with sensitive skin.`,
  },
  {
    title: "Photo & Social Media",
    content: `We love sharing our work! By booking with T Creative Studio, you agree that:\n\n• We may take before/after photos during your appointment for portfolio purposes.\n• Photos may be shared on our Instagram, website, and other marketing materials.\n• If you do not wish to be photographed, please let us know at the start of your appointment.`,
  },
  {
    title: "Satisfaction & Returns",
    content: `Your satisfaction matters to us.\n\n• If you experience any concerns with your lash retention within 72 hours, contact us and we will assess and correct at no charge.\n• Products purchased in-studio can be exchanged within 7 days if unopened.\n• Training deposits are non-refundable once a start date is confirmed.`,
  },
];

/**
 * One-time seed function: populates the policies table with hardcoded default
 * aftercare sections and studio policies if the table is completely empty.
 *
 * Side-effects:
 * - Inserts multiple rows into the policies table (both aftercare and studio_policy types).
 * - No-ops if any rows already exist, preventing duplicate seeds.
 */
export async function seedAftercareDefaults(): Promise<void> {
  try {
    await requireAdmin();

    // QUERY: Check whether the policies table has any rows at all.
    // SELECT — Only the id column (we just need to know if at least one row exists).
    // FROM   — policies table.
    // LIMIT 1 — Stop after finding the first row; we don't need a count.
    // Only seed if empty
    const existing = await db.select({ id: policies.id }).from(policies).limit(1);
    if (existing.length > 0) return;

    // Transform the hardcoded aftercare defaults into insert-ready objects,
    // using the array index as sortOrder so they appear in the defined sequence.
    // The dos/donts arrays are serialised to a JSON string for the content column.
    const aftercareValues = DEFAULT_AFTERCARE.map((a, i) => ({
      type: "aftercare" as const,
      slug: slugify(a.title) + "-aftercare",
      title: a.title,
      content: JSON.stringify({ dos: a.dos, donts: a.donts }),
      category: a.category as "lash" | "jewelry" | "crochet" | "consulting",
      sortOrder: i,
    }));

    // Same pattern as aftercareValues: transform policy defaults into insert
    // objects with index-based sortOrder and a slug derived from the title.
    const policyValues = DEFAULT_POLICIES.map((p, i) => ({
      type: "studio_policy" as const,
      slug: slugify(p.title) + "-policy",
      title: p.title,
      content: p.content,
      sortOrder: i,
    }));

    // MUTATION: Bulk-insert all default aftercare sections and studio policies in one query.
    // The spread combines both arrays into a single INSERT with multiple value tuples.
    await db.insert(policies).values([...aftercareValues, ...policyValues]);
  } catch (err) {
    Sentry.captureException(err);
    throw err;
  }
}
