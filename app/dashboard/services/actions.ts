/**
 * app/dashboard/services/actions.ts — Server actions for the `services` table.
 *
 * ## Pattern
 * All exported functions are Next.js Server Actions (`"use server"`). They:
 * 1. Call `getUser()` as an auth guard — throws if no active session.
 * 2. Execute a Drizzle query against the `services` table.
 * 3. Call `revalidatePath("/dashboard/services")` on mutations so the server
 *    component re-fetches on next navigation without a full page reload.
 *
 * ## Auth guard
 * `getUser()` uses Supabase's server-side auth client. It does NOT rely on
 * cookies set by the client — it validates the session JWT server-side,
 * which is safe against CSRF and cookie tampering.
 *
 * ## seedServiceCatalog
 * A one-click import that replaces generic onboarding placeholder services
 * with the full real catalog. Safe to call multiple times — idempotent by
 * name-based deduplication.
 *
 * ## Type exports
 * - `ServiceRow`   — Drizzle-inferred row type from the `services` table.
 * - `ServiceInput` — Input shape for create/update mutations.
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";
import { createClient } from "@/utils/supabase/server";

/* ------------------------------------------------------------------ */
/*  Full service catalog — Trini's real menu                          */
/* ------------------------------------------------------------------ */

type CatalogEntry = {
  category: "lash" | "jewelry" | "crochet" | "consulting";
  name: string;
  description: string;
  durationMinutes: number | null;
  priceInCents: number;
  depositInCents: number | null;
  sortOrder: number;
};

const FULL_CATALOG: CatalogEntry[] = [
  // ── Lash ────────────────────────────────────────────────────────
  {
    category: "lash",
    name: "Classic Full Set",
    description:
      "Natural-looking lash extensions, one extension per natural lash. Perfect for first-timers.",
    durationMinutes: 90,
    priceInCents: 12000,
    depositInCents: null,
    sortOrder: 1,
  },
  {
    category: "lash",
    name: "Classic Lash Fill",
    description:
      "Maintenance fill for an existing classic set. Must be within 3 weeks of last appointment.",
    durationMinutes: 60,
    priceInCents: 6500,
    depositInCents: null,
    sortOrder: 2,
  },
  {
    category: "lash",
    name: "Hybrid Full Set",
    description: "Mix of classic and volume techniques for a textured, wispy, natural-glam look.",
    durationMinutes: 105,
    priceInCents: 14500,
    depositInCents: null,
    sortOrder: 3,
  },
  {
    category: "lash",
    name: "Hybrid Fill",
    description: "Fill for an existing hybrid set. Must be within 3 weeks.",
    durationMinutes: 75,
    priceInCents: 8000,
    depositInCents: null,
    sortOrder: 4,
  },
  {
    category: "lash",
    name: "Volume Full Set",
    description: "Handcrafted fans of 2–6 extensions per natural lash for a full, dramatic look.",
    durationMinutes: 120,
    priceInCents: 16500,
    depositInCents: 5000,
    sortOrder: 5,
  },
  {
    category: "lash",
    name: "Volume Fill",
    description: "Fill for an existing volume set. Must be within 3 weeks.",
    durationMinutes: 90,
    priceInCents: 9500,
    depositInCents: null,
    sortOrder: 6,
  },
  {
    category: "lash",
    name: "Mega Volume Set",
    description: "Ultra-dramatic look using 8–16 ultra-fine extensions per natural lash.",
    durationMinutes: 150,
    priceInCents: 22000,
    depositInCents: 11000,
    sortOrder: 7,
  },
  {
    category: "lash",
    name: "Mega Volume Fill",
    description: "Fill for an existing mega volume set. Must be within 2 weeks.",
    durationMinutes: 105,
    priceInCents: 12000,
    depositInCents: null,
    sortOrder: 8,
  },
  {
    category: "lash",
    name: "Lash Removal",
    description: "Safe, professional removal of lash extensions with no damage to natural lashes.",
    durationMinutes: 30,
    priceInCents: 2500,
    depositInCents: null,
    sortOrder: 9,
  },
  // ── Permanent Jewelry ────────────────────────────────────────────
  {
    category: "jewelry",
    name: "Permanent Bracelet Weld",
    description:
      "Custom-fit permanent bracelet welded directly on your wrist. No clasp — stays on forever.",
    durationMinutes: 30,
    priceInCents: 6500,
    depositInCents: null,
    sortOrder: 1,
  },
  {
    category: "jewelry",
    name: "Permanent Anklet Weld",
    description:
      "Custom-fit permanent anklet welded on your ankle. Water-safe and tarnish-resistant.",
    durationMinutes: 30,
    priceInCents: 6500,
    depositInCents: null,
    sortOrder: 2,
  },
  {
    category: "jewelry",
    name: "Permanent Necklace Weld",
    description:
      "Delicate permanent necklace welded to your desired length. Lightweight and dainty.",
    durationMinutes: 45,
    priceInCents: 8500,
    depositInCents: null,
    sortOrder: 3,
  },
  {
    category: "jewelry",
    name: "Chain Sizing & Repair",
    description: "Sizing adjustment or repair of existing permanent jewelry. Bring your piece in.",
    durationMinutes: 20,
    priceInCents: 2500,
    depositInCents: null,
    sortOrder: 4,
  },
  // ── Crochet ─────────────────────────────────────────────────────
  {
    category: "crochet",
    name: "Crochet Braid Install",
    description:
      "Full crochet braid install. Hair not included unless add-on is selected at booking.",
    durationMinutes: 180,
    priceInCents: 12000,
    depositInCents: 7500,
    sortOrder: 1,
  },
  {
    category: "crochet",
    name: "Crochet Updo",
    description:
      "Elegant crochet updo for special events. Consultation required for bridal styles.",
    durationMinutes: 120,
    priceInCents: 9500,
    depositInCents: 5000,
    sortOrder: 2,
  },
  {
    category: "crochet",
    name: "Takedown & Detangle",
    description: "Professional removal of crochet or protective style with gentle detangling.",
    durationMinutes: 60,
    priceInCents: 4500,
    depositInCents: null,
    sortOrder: 3,
  },
  // ── Consulting ───────────────────────────────────────────────────
  {
    category: "consulting",
    name: "Discovery Call",
    description: "Free 30-minute intro call to discuss your business goals and how we can help.",
    durationMinutes: 30,
    priceInCents: 0,
    depositInCents: null,
    sortOrder: 1,
  },
  {
    category: "consulting",
    name: "HR Strategy Session",
    description: "Deep-dive session on hiring, team structure, onboarding, and HR documentation.",
    durationMinutes: 60,
    priceInCents: 15000,
    depositInCents: 7500,
    sortOrder: 2,
  },
  {
    category: "consulting",
    name: "Employee Handbook Build",
    description: "Full custom employee handbook drafted for your beauty business. Project-based.",
    durationMinutes: null,
    priceInCents: 35000,
    depositInCents: 17500,
    sortOrder: 3,
  },
  {
    category: "consulting",
    name: "Business Launch Package",
    description:
      "End-to-end support launching your beauty brand: branding, HR docs, and pricing strategy.",
    durationMinutes: null,
    priceInCents: 50000,
    depositInCents: 15000,
    sortOrder: 4,
  },
];

/** One-click action to replace generic onboarding placeholders with the full real catalog. */
export async function seedServiceCatalog(): Promise<ServiceRow[]> {
  await getUser();

  // Remove the generic single-service placeholders the onboarding created.
  // These names are safe to delete — the real services have more specific names.
  const GENERIC_NAMES = ["Lash Extensions", "Permanent Jewelry", "Crochet", "Consulting"];
  const existing = await db.select({ id: services.id, name: services.name }).from(services);
  const genericIds = existing.filter((s) => GENERIC_NAMES.includes(s.name)).map((s) => s.id);

  if (genericIds.length > 0) {
    await db.delete(services).where(inArray(services.id, genericIds));
  }

  // Only insert services whose name doesn't already exist (safe to re-run).
  const existingNames = new Set(
    existing.filter((s) => !genericIds.includes(s.id)).map((s) => s.name),
  );
  const toInsert = FULL_CATALOG.filter((c) => !existingNames.has(c.name));

  const rows = toInsert.length > 0 ? await db.insert(services).values(toInsert).returning() : [];

  revalidatePath("/dashboard/services");
  return rows;
}

export type ServiceRow = typeof services.$inferSelect;

export type ServiceInput = {
  name: string;
  category: ServiceRow["category"];
  description: string;
  durationMinutes: number;
  priceInCents: number;
  depositInCents: number;
  isActive: boolean;
};

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function getServices(): Promise<ServiceRow[]> {
  await getUser();
  return db.select().from(services).orderBy(services.category, services.sortOrder);
}

export async function createService(input: ServiceInput): Promise<ServiceRow> {
  await getUser();
  const [row] = await db
    .insert(services)
    .values({
      name: input.name,
      category: input.category,
      description: input.description || null,
      durationMinutes: input.durationMinutes || null,
      priceInCents: input.priceInCents,
      depositInCents: input.depositInCents || null,
      isActive: input.isActive,
    })
    .returning();
  revalidatePath("/dashboard/services");
  return row;
}

export async function updateService(id: number, input: ServiceInput): Promise<ServiceRow> {
  await getUser();
  const [row] = await db
    .update(services)
    .set({
      name: input.name,
      category: input.category,
      description: input.description || null,
      durationMinutes: input.durationMinutes || null,
      priceInCents: input.priceInCents,
      depositInCents: input.depositInCents || null,
      isActive: input.isActive,
    })
    .where(eq(services.id, id))
    .returning();
  revalidatePath("/dashboard/services");
  return row;
}

export async function deleteService(id: number): Promise<void> {
  await getUser();
  await db.delete(services).where(eq(services.id, id));
  revalidatePath("/dashboard/services");
}

export async function toggleServiceActive(id: number, isActive: boolean): Promise<void> {
  await getUser();
  await db.update(services).set({ isActive }).where(eq(services.id, id));
  revalidatePath("/dashboard/services");
}
