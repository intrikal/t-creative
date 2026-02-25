"use server";

import { revalidatePath } from "next/cache";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { policies } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Auth guard                                                         */
/* ------------------------------------------------------------------ */

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AftercareSection = {
  id: number;
  title: string;
  category: string | null;
  dos: string[];
  donts: string[];
};

export type PolicyEntry = {
  id: number;
  title: string;
  content: string;
};

export type AftercareSectionInput = {
  title: string;
  category?: string;
  dos: string[];
  donts: string[];
};

export type PolicyInput = {
  title: string;
  content: string;
};

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

export async function getAftercareSections(): Promise<AftercareSection[]> {
  await getUser();

  const rows = await db
    .select()
    .from(policies)
    .where(eq(policies.type, "aftercare"))
    .orderBy(asc(policies.sortOrder), asc(policies.id));

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
}

export async function getPolicies(): Promise<PolicyEntry[]> {
  await getUser();

  const rows = await db
    .select()
    .from(policies)
    .where(eq(policies.type, "studio_policy"))
    .orderBy(asc(policies.sortOrder), asc(policies.id));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
  }));
}

/* ------------------------------------------------------------------ */
/*  Mutations — Aftercare sections                                     */
/* ------------------------------------------------------------------ */

export async function createAftercareSection(input: AftercareSectionInput): Promise<void> {
  await getUser();

  const maxSort = await db
    .select({ sortOrder: policies.sortOrder })
    .from(policies)
    .where(eq(policies.type, "aftercare"))
    .orderBy(asc(policies.sortOrder));

  const nextSort = maxSort.length > 0 ? maxSort[maxSort.length - 1].sortOrder + 1 : 0;

  await db.insert(policies).values({
    type: "aftercare",
    slug: slugify(input.title) + "-aftercare",
    title: input.title,
    content: JSON.stringify({ dos: input.dos, donts: input.donts }),
    category: (input.category as "lash" | "jewelry" | "crochet" | "consulting") ?? null,
    sortOrder: nextSort,
  });

  revalidatePath("/dashboard/aftercare");
}

export async function updateAftercareSection(
  id: number,
  input: AftercareSectionInput,
): Promise<void> {
  await getUser();

  await db
    .update(policies)
    .set({
      title: input.title,
      slug: slugify(input.title) + "-aftercare",
      content: JSON.stringify({ dos: input.dos, donts: input.donts }),
      category: (input.category as "lash" | "jewelry" | "crochet" | "consulting") ?? null,
    })
    .where(eq(policies.id, id));

  revalidatePath("/dashboard/aftercare");
}

export async function deleteAftercareSection(id: number): Promise<void> {
  await getUser();
  await db.delete(policies).where(eq(policies.id, id));
  revalidatePath("/dashboard/aftercare");
}

/* ------------------------------------------------------------------ */
/*  Mutations — Studio policies                                        */
/* ------------------------------------------------------------------ */

export async function createPolicy(input: PolicyInput): Promise<void> {
  await getUser();

  const maxSort = await db
    .select({ sortOrder: policies.sortOrder })
    .from(policies)
    .where(eq(policies.type, "studio_policy"))
    .orderBy(asc(policies.sortOrder));

  const nextSort = maxSort.length > 0 ? maxSort[maxSort.length - 1].sortOrder + 1 : 0;

  await db.insert(policies).values({
    type: "studio_policy",
    slug: slugify(input.title) + "-policy",
    title: input.title,
    content: input.content,
    sortOrder: nextSort,
  });

  revalidatePath("/dashboard/aftercare");
}

export async function updatePolicy(id: number, input: PolicyInput): Promise<void> {
  await getUser();

  await db
    .update(policies)
    .set({
      title: input.title,
      slug: slugify(input.title) + "-policy",
      content: input.content,
    })
    .where(eq(policies.id, id));

  revalidatePath("/dashboard/aftercare");
}

export async function deletePolicy(id: number): Promise<void> {
  await getUser();
  await db.delete(policies).where(eq(policies.id, id));
  revalidatePath("/dashboard/aftercare");
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

export async function seedAftercareDefaults(): Promise<void> {
  await getUser();

  // Only seed if empty
  const existing = await db.select({ id: policies.id }).from(policies).limit(1);
  if (existing.length > 0) return;

  const aftercareValues = DEFAULT_AFTERCARE.map((a, i) => ({
    type: "aftercare" as const,
    slug: slugify(a.title) + "-aftercare",
    title: a.title,
    content: JSON.stringify({ dos: a.dos, donts: a.donts }),
    category: a.category as "lash" | "jewelry" | "crochet" | "consulting",
    sortOrder: i,
  }));

  const policyValues = DEFAULT_POLICIES.map((p, i) => ({
    type: "studio_policy" as const,
    slug: slugify(p.title) + "-policy",
    title: p.title,
    content: p.content,
    sortOrder: i,
  }));

  await db.insert(policies).values([...aftercareValues, ...policyValues]);
}
