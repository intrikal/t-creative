/**
 * Shared site constants — used by non-DB-connected code (backup filenames,
 * health route docs, iCal PRODID, etc.) where a database lookup would be
 * inappropriate or impossible.
 *
 * For user-facing business name / branding, prefer `getPublicBusinessProfile()`
 * from settings-actions or `getSiteData()` from lib/site-data instead.
 */

/** Canonical production base URL. Falls back to localhost in dev. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tcreativestudio.com";

/** Short identifier used in filenames, iCal PRODID, and UID domains. */
export const SITE_SLUG = "tcreative";

/** Domain used for iCal UIDs and PRODID. Derived from SITE_URL at startup. */
export const SITE_DOMAIN = new URL(SITE_URL).hostname;
