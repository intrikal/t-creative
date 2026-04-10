/**
 * sms-templates — Template rendering for automated SMS messages.
 *
 * Templates use Mustache-style {{variableName}} placeholders.
 * Admin edits templates via the dashboard; cron jobs call renderSmsTemplate()
 * at send time.
 */
import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { smsTemplates } from "@/db/schema";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type SmsTemplate = typeof smsTemplates.$inferSelect;

/* ------------------------------------------------------------------ */
/*  Hardcoded defaults (graceful fallback if DB row is missing)        */
/* ------------------------------------------------------------------ */

const DEFAULTS: Record<string, string> = {
  "booking-reminder":
    "Hi {{clientFirstName}}! Reminder: your {{serviceName}} appt at {{businessName}} is {{startsAtFormatted}}. Reply C to confirm or X to cancel. Reply STOP to opt out.",
  "birthday-promo":
    "Happy early birthday, {{firstName}}! 🎂 Use code {{promoCode}} for {{discountPercent}}% off your next visit at {{businessName}}. Valid for 30 days after your birthday. Reply STOP to opt out.",
};

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

/** Replace all {{variable}} placeholders with the supplied values. */
function interpolate(body: string, variables: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => variables[key] ?? match);
}

/** Cached fetch — revalidated when an admin edits a template. */
const fetchTemplate = unstable_cache(
  async (slug: string) => {
    const [row] = await db.select().from(smsTemplates).where(eq(smsTemplates.slug, slug)).limit(1);
    return row ?? null;
  },
  ["sms-template"],
  { revalidate: 300, tags: ["sms-templates"] },
);

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Render a template by slug with the given variable values.
 *
 * Returns `null` if the template exists but is inactive.
 * Falls back to a hardcoded default if the DB row is missing entirely,
 * so the feature degrades gracefully before the migration runs.
 */
export async function renderSmsTemplate(
  slug: string,
  variables: Record<string, string>,
): Promise<string | null> {
  const template = await fetchTemplate(slug);

  if (!template) {
    const fallback = DEFAULTS[slug];
    return fallback ? interpolate(fallback, variables) : null;
  }

  if (!template.isActive) return null;

  return interpolate(template.body, variables);
}

/** List all templates — admin dashboard. */
export async function getSmsTemplates(): Promise<SmsTemplate[]> {
  return db.select().from(smsTemplates).orderBy(smsTemplates.name);
}

/** Fetch a single template by slug. */
export async function getSmsTemplate(slug: string): Promise<SmsTemplate | null> {
  const [row] = await db.select().from(smsTemplates).where(eq(smsTemplates.slug, slug)).limit(1);
  return row ?? null;
}

/** Update a template's body. */
export async function updateSmsTemplate(slug: string, body: string): Promise<void> {
  await db.update(smsTemplates).set({ body }).where(eq(smsTemplates.slug, slug));
}

/** Get the hardcoded default body for a slug, or null if unknown. */
export function getDefaultBody(slug: string): string | null {
  return DEFAULTS[slug] ?? null;
}
