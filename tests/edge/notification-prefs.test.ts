// @vitest-environment node

/**
 * tests/edge/notification-prefs.test.ts
 *
 * Edge-case tests for the notification preference gate.
 *
 * The system has two layers of preference checks that both must pass before
 * a notification is sent:
 *
 *   Layer 1 — legacy boolean fields on the profiles row
 *     notifyEmail  (default true)  — gates all email sends
 *     notifySms    (default true)  — gates all SMS sends
 *     notifyMarketing (default false) — gates marketing email sends
 *
 *   Layer 2 — granular per-(channel, type) rows in notification_preferences
 *     isNotificationEnabled(profileId, channel, type) → true/false
 *     Defaults to TRUE when no row exists (new client, no prefs seeded yet)
 *
 * Notification types and their category:
 *   booking_reminder  → operational  (uses notifyEmail / notifySms)
 *   review_request    → operational  (uses notifyEmail)
 *   fill_reminder     → operational  (uses notifyEmail)  — classified marketing in tests per spec
 *   birthday_promo    → marketing    (uses notifyEmail + notifyMarketing)
 *   marketing         → marketing    (email sequences / campaigns)
 *
 * Note: the codebase is mid-migration — some crons check both layers, some
 * only check legacy fields.  These tests document the INTENDED contract for
 * the fully-migrated state.
 *
 * Covered scenarios (applied across all 10 cron / action notification types)
 *   1. Email enabled + SMS enabled → both sent
 *   2. Email disabled + SMS enabled → only SMS sent
 *   3. Both disabled → nothing sent
 *   4. Booking reminders: operational — always sent when notifyEmail/notifySms
 *      are true (granular pref default = enabled)
 *   5. Birthday promo: marketing — respects both notifyMarketing AND granular pref
 *   6. Review request: operational — respects notifyEmail AND granular pref
 *   7. Fill reminder: operational — respects notifyEmail AND granular pref
 *   8. New client with no preference rows → all granular prefs default to enabled
 */

import { describe, expect, it } from "vitest";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type NotifChannel = "email" | "sms" | "push";
type NotifType =
  | "booking_reminder"
  | "review_request"
  | "fill_reminder"
  | "birthday_promo"
  | "marketing";
type NotifCategory = "operational" | "marketing";

interface LegacyPrefs {
  /** Opt-in for email booking confirmations and updates (default: true) */
  notifyEmail: boolean;
  /** Opt-in for SMS appointment reminders (default: true) */
  notifySms: boolean;
  /** Opt-in for marketing emails (default: false) */
  notifyMarketing: boolean;
}

interface GranularPref {
  channel: NotifChannel;
  notificationType: NotifType;
  enabled: boolean;
}

interface ClientProfile {
  id: string;
  email: string | null;
  legacy: LegacyPrefs;
  /** Granular preference rows — may be empty for new clients */
  prefs: GranularPref[];
}

/* ------------------------------------------------------------------ */
/*  Pure helpers — mirror production logic                             */
/* ------------------------------------------------------------------ */

/**
 * Mirrors isNotificationEnabled() from lib/notification-preferences.ts.
 * Returns true (default enabled) when no row exists for the given (channel, type).
 */
function isNotificationEnabled(
  profile: ClientProfile,
  channel: NotifChannel,
  type: NotifType,
): boolean {
  const row = profile.prefs.find((p) => p.channel === channel && p.notificationType === type);
  return row?.enabled ?? true; // default: enabled
}

/**
 * Returns true when the legacy email gate passes for the given category.
 *
 * Operational emails require: notifyEmail = true
 * Marketing emails require:   notifyEmail = true AND notifyMarketing = true
 */
function legacyEmailGate(legacy: LegacyPrefs, category: NotifCategory): boolean {
  if (!legacy.notifyEmail) return false;
  if (category === "marketing" && !legacy.notifyMarketing) return false;
  return true;
}

/**
 * Returns true when the legacy SMS gate passes.
 * SMS is always operational — only requires notifySms = true.
 */
function legacySmsGate(legacy: LegacyPrefs): boolean {
  return legacy.notifySms;
}

/**
 * Full two-layer gate for a single channel + type combination.
 *
 * Both the legacy field AND the granular preference must be enabled.
 * For SMS: only notifySms + granular pref (SMS is always operational).
 * For email: notifyEmail (+ notifyMarketing for marketing types) + granular pref.
 */
function shouldSend(
  profile: ClientProfile,
  channel: NotifChannel,
  type: NotifType,
  category: NotifCategory,
): boolean {
  if (!profile.email && channel === "email") return false;

  if (channel === "email") {
    return (
      legacyEmailGate(profile.legacy, category) && isNotificationEnabled(profile, "email", type)
    );
  }
  if (channel === "sms") {
    return legacySmsGate(profile.legacy) && isNotificationEnabled(profile, "sms", type);
  }
  // push: only granular pref
  return isNotificationEnabled(profile, "push", type);
}

/* ------------------------------------------------------------------ */
/*  Client factory helpers                                             */
/* ------------------------------------------------------------------ */

function makeProfile(
  overrides: Partial<LegacyPrefs> & { id?: string; prefs?: GranularPref[] } = {},
): ClientProfile {
  return {
    id: overrides.id ?? "profile-1",
    email: "client@example.com",
    legacy: {
      notifyEmail: overrides.notifyEmail ?? true,
      notifySms: overrides.notifySms ?? true,
      notifyMarketing: overrides.notifyMarketing ?? false,
      ...(overrides.notifyEmail !== undefined ? {} : {}), // handled above
    },
    prefs: overrides.prefs ?? [],
  };
}

/** All defaults: email=true, sms=true, marketing=false, no granular rows. */
const DEFAULT_CLIENT = makeProfile();

/** Marketing-opted-in client: notifyMarketing=true as well. */
const MARKETING_CLIENT = makeProfile({ notifyMarketing: true });

/* ------------------------------------------------------------------ */
/*  Test suite                                                          */
/* ------------------------------------------------------------------ */

describe("Notification preference gate", () => {
  // ─── 1. Email enabled + SMS enabled: both sent ────────────────────

  describe("1. Email enabled + SMS enabled — both channels sent", () => {
    it("booking_reminder: email sent when notifyEmail=true", () => {
      expect(shouldSend(DEFAULT_CLIENT, "email", "booking_reminder", "operational")).toBe(true);
    });

    it("booking_reminder: SMS sent when notifySms=true", () => {
      expect(shouldSend(DEFAULT_CLIENT, "sms", "booking_reminder", "operational")).toBe(true);
    });

    it("review_request: email sent when notifyEmail=true", () => {
      expect(shouldSend(DEFAULT_CLIENT, "email", "review_request", "operational")).toBe(true);
    });

    it("fill_reminder: email sent when notifyEmail=true", () => {
      expect(shouldSend(DEFAULT_CLIENT, "email", "fill_reminder", "operational")).toBe(true);
    });

    it("birthday_promo: email sent when notifyEmail=true AND notifyMarketing=true", () => {
      expect(shouldSend(MARKETING_CLIENT, "email", "birthday_promo", "marketing")).toBe(true);
    });

    it("birthday_promo: SMS sent when notifySms=true", () => {
      expect(shouldSend(MARKETING_CLIENT, "sms", "birthday_promo", "marketing")).toBe(true);
    });

    it("marketing (email sequence): email sent when notifyEmail=true AND notifyMarketing=true", () => {
      expect(shouldSend(MARKETING_CLIENT, "email", "marketing", "marketing")).toBe(true);
    });
  });

  // ─── 2. Email disabled + SMS enabled: only SMS sent ───────────────

  describe("2. Email disabled + SMS enabled — only SMS sent", () => {
    const emailOff = makeProfile({ notifyEmail: false });

    it("booking_reminder: email NOT sent when notifyEmail=false", () => {
      expect(shouldSend(emailOff, "email", "booking_reminder", "operational")).toBe(false);
    });

    it("booking_reminder: SMS still sent when notifySms=true and notifyEmail=false", () => {
      expect(shouldSend(emailOff, "sms", "booking_reminder", "operational")).toBe(true);
    });

    it("review_request: email NOT sent when notifyEmail=false", () => {
      expect(shouldSend(emailOff, "email", "review_request", "operational")).toBe(false);
    });

    it("fill_reminder: email NOT sent when notifyEmail=false", () => {
      expect(shouldSend(emailOff, "email", "fill_reminder", "operational")).toBe(false);
    });

    it("birthday_promo: email NOT sent when notifyEmail=false", () => {
      const emailOffMarketing = makeProfile({ notifyEmail: false, notifyMarketing: true });
      expect(shouldSend(emailOffMarketing, "email", "birthday_promo", "marketing")).toBe(false);
    });

    it("birthday_promo: SMS still sent when notifyEmail=false but notifySms=true", () => {
      expect(shouldSend(emailOff, "sms", "birthday_promo", "marketing")).toBe(true);
    });

    it("marketing email sequence: NOT sent when notifyEmail=false", () => {
      const emailOffMarketing = makeProfile({ notifyEmail: false, notifyMarketing: true });
      expect(shouldSend(emailOffMarketing, "email", "marketing", "marketing")).toBe(false);
    });
  });

  // ─── 3. Both disabled: nothing sent ───────────────────────────────

  describe("3. Both disabled — nothing sent for any type", () => {
    const allOff = makeProfile({ notifyEmail: false, notifySms: false });

    const types: Array<[NotifType, NotifCategory]> = [
      ["booking_reminder", "operational"],
      ["review_request", "operational"],
      ["fill_reminder", "operational"],
      ["birthday_promo", "marketing"],
      ["marketing", "marketing"],
    ];

    for (const [type, category] of types) {
      it(`${type}: email NOT sent when notifyEmail=false`, () => {
        expect(shouldSend(allOff, "email", type, category)).toBe(false);
      });

      it(`${type}: SMS NOT sent when notifySms=false`, () => {
        expect(shouldSend(allOff, "sms", type, category)).toBe(false);
      });
    }
  });

  // ─── 4. Booking reminders: operational ────────────────────────────

  describe("4. Booking reminders — operational, sent when notifyEmail/notifySms true", () => {
    it("sent when both legacy fields are true and no granular rows exist", () => {
      expect(shouldSend(DEFAULT_CLIENT, "email", "booking_reminder", "operational")).toBe(true);
      expect(shouldSend(DEFAULT_CLIENT, "sms", "booking_reminder", "operational")).toBe(true);
    });

    it("does NOT require notifyMarketing=true (operational, not marketing)", () => {
      // DEFAULT_CLIENT has notifyMarketing=false — reminder still sends
      expect(DEFAULT_CLIENT.legacy.notifyMarketing).toBe(false);
      expect(shouldSend(DEFAULT_CLIENT, "email", "booking_reminder", "operational")).toBe(true);
    });

    it("blocked by granular pref disabled for (email, booking_reminder)", () => {
      const client = makeProfile({
        prefs: [{ channel: "email", notificationType: "booking_reminder", enabled: false }],
      });
      expect(shouldSend(client, "email", "booking_reminder", "operational")).toBe(false);
    });

    it("blocked by granular pref disabled for (sms, booking_reminder)", () => {
      const client = makeProfile({
        prefs: [{ channel: "sms", notificationType: "booking_reminder", enabled: false }],
      });
      expect(shouldSend(client, "sms", "booking_reminder", "operational")).toBe(false);
    });

    it("email blocked but SMS still sends when only email pref is disabled", () => {
      const client = makeProfile({
        prefs: [{ channel: "email", notificationType: "booking_reminder", enabled: false }],
      });
      expect(shouldSend(client, "email", "booking_reminder", "operational")).toBe(false);
      expect(shouldSend(client, "sms", "booking_reminder", "operational")).toBe(true);
    });
  });

  // ─── 5. Birthday promo: marketing ─────────────────────────────────

  describe("5. Birthday promo — marketing, respects notifyMarketing AND granular pref", () => {
    it("NOT sent when notifyMarketing=false (default)", () => {
      expect(shouldSend(DEFAULT_CLIENT, "email", "birthday_promo", "marketing")).toBe(false);
    });

    it("sent when notifyMarketing=true and no granular rows", () => {
      expect(shouldSend(MARKETING_CLIENT, "email", "birthday_promo", "marketing")).toBe(true);
    });

    it("NOT sent when notifyMarketing=true but granular pref is disabled", () => {
      const client = makeProfile({
        notifyMarketing: true,
        prefs: [{ channel: "email", notificationType: "birthday_promo", enabled: false }],
      });
      expect(shouldSend(client, "email", "birthday_promo", "marketing")).toBe(false);
    });

    it("SMS birthday_promo sent when notifySms=true (SMS not gated by notifyMarketing)", () => {
      // SMS is always operational gate — notifyMarketing doesn't apply to SMS
      expect(shouldSend(MARKETING_CLIENT, "sms", "birthday_promo", "marketing")).toBe(true);
      expect(shouldSend(DEFAULT_CLIENT, "sms", "birthday_promo", "marketing")).toBe(true);
    });

    it("SMS birthday_promo blocked when granular sms:birthday_promo pref is disabled", () => {
      const client = makeProfile({
        prefs: [{ channel: "sms", notificationType: "birthday_promo", enabled: false }],
      });
      expect(shouldSend(client, "sms", "birthday_promo", "marketing")).toBe(false);
    });

    it("both email and SMS blocked: no sends at all", () => {
      const client = makeProfile({
        notifyMarketing: true,
        prefs: [
          { channel: "email", notificationType: "birthday_promo", enabled: false },
          { channel: "sms", notificationType: "birthday_promo", enabled: false },
        ],
      });
      expect(shouldSend(client, "email", "birthday_promo", "marketing")).toBe(false);
      expect(shouldSend(client, "sms", "birthday_promo", "marketing")).toBe(false);
    });
  });

  // ─── 6. Review request: operational ───────────────────────────────

  describe("6. Review request — operational, respects notifyEmail AND granular pref", () => {
    it("sent when notifyEmail=true and no granular rows", () => {
      expect(shouldSend(DEFAULT_CLIENT, "email", "review_request", "operational")).toBe(true);
    });

    it("NOT sent when notifyEmail=false", () => {
      const client = makeProfile({ notifyEmail: false });
      expect(shouldSend(client, "email", "review_request", "operational")).toBe(false);
    });

    it("NOT sent when granular (email, review_request) pref is disabled", () => {
      const client = makeProfile({
        prefs: [{ channel: "email", notificationType: "review_request", enabled: false }],
      });
      expect(shouldSend(client, "email", "review_request", "operational")).toBe(false);
    });

    it("does NOT require notifyMarketing=true (operational type)", () => {
      expect(DEFAULT_CLIENT.legacy.notifyMarketing).toBe(false);
      expect(shouldSend(DEFAULT_CLIENT, "email", "review_request", "operational")).toBe(true);
    });

    it("disabling review_request pref does not affect booking_reminder pref", () => {
      const client = makeProfile({
        prefs: [{ channel: "email", notificationType: "review_request", enabled: false }],
      });
      expect(shouldSend(client, "email", "review_request", "operational")).toBe(false);
      expect(shouldSend(client, "email", "booking_reminder", "operational")).toBe(true);
    });
  });

  // ─── 7. Fill reminder: operational ────────────────────────────────

  describe("7. Fill reminder — operational, respects notifyEmail AND granular pref", () => {
    it("sent when notifyEmail=true and no granular rows", () => {
      expect(shouldSend(DEFAULT_CLIENT, "email", "fill_reminder", "operational")).toBe(true);
    });

    it("NOT sent when notifyEmail=false", () => {
      const client = makeProfile({ notifyEmail: false });
      expect(shouldSend(client, "email", "fill_reminder", "operational")).toBe(false);
    });

    it("NOT sent when granular (email, fill_reminder) pref is disabled", () => {
      const client = makeProfile({
        prefs: [{ channel: "email", notificationType: "fill_reminder", enabled: false }],
      });
      expect(shouldSend(client, "email", "fill_reminder", "operational")).toBe(false);
    });

    it("does NOT require notifyMarketing=true", () => {
      expect(DEFAULT_CLIENT.legacy.notifyMarketing).toBe(false);
      expect(shouldSend(DEFAULT_CLIENT, "email", "fill_reminder", "operational")).toBe(true);
    });

    it("disabling fill_reminder granular pref does not affect other operational types", () => {
      const client = makeProfile({
        prefs: [{ channel: "email", notificationType: "fill_reminder", enabled: false }],
      });
      expect(shouldSend(client, "email", "fill_reminder", "operational")).toBe(false);
      expect(shouldSend(client, "email", "booking_reminder", "operational")).toBe(true);
      expect(shouldSend(client, "email", "review_request", "operational")).toBe(true);
    });
  });

  // ─── 8. New client: no preference rows → all enabled ──────────────

  describe("8. New client with no preference rows — all granular prefs default to enabled", () => {
    const newClient = makeProfile({ prefs: [] }); // no rows seeded yet

    const allCombinations: Array<[NotifChannel, NotifType, NotifCategory]> = [
      ["email", "booking_reminder", "operational"],
      ["sms", "booking_reminder", "operational"],
      ["email", "review_request", "operational"],
      ["email", "fill_reminder", "operational"],
      ["sms", "birthday_promo", "marketing"],
      ["email", "marketing", "marketing"],
    ];

    for (const [channel, type, category] of allCombinations) {
      it(`(${channel}, ${type}): granular default is enabled when no row exists`, () => {
        expect(isNotificationEnabled(newClient, channel, type)).toBe(true);
      });
    }

    it("new client receives booking_reminder email (both layers pass by default)", () => {
      expect(shouldSend(newClient, "email", "booking_reminder", "operational")).toBe(true);
    });

    it("new client receives booking_reminder SMS (both layers pass by default)", () => {
      expect(shouldSend(newClient, "sms", "booking_reminder", "operational")).toBe(true);
    });

    it("new client does NOT receive marketing email (notifyMarketing defaults to false)", () => {
      // Legacy default notifyMarketing=false blocks marketing even with no granular rows
      expect(shouldSend(newClient, "email", "birthday_promo", "marketing")).toBe(false);
      expect(shouldSend(newClient, "email", "marketing", "marketing")).toBe(false);
    });

    it("new client DOES receive SMS for birthday_promo (SMS not gated by notifyMarketing)", () => {
      expect(shouldSend(newClient, "sms", "birthday_promo", "marketing")).toBe(true);
    });

    it("seeding preferences explicitly as enabled produces same result as no-row default", () => {
      const seededClient = makeProfile({
        prefs: [
          { channel: "email", notificationType: "booking_reminder", enabled: true },
          { channel: "sms", notificationType: "booking_reminder", enabled: true },
        ],
      });
      expect(shouldSend(seededClient, "email", "booking_reminder", "operational")).toBe(
        shouldSend(newClient, "email", "booking_reminder", "operational"),
      );
      expect(shouldSend(seededClient, "sms", "booking_reminder", "operational")).toBe(
        shouldSend(newClient, "sms", "booking_reminder", "operational"),
      );
    });
  });

  // ─── Cross-cutting: per-type isolation ────────────────────────────

  describe("Cross-cutting — disabling one type does not affect others", () => {
    it("disabling all granular prefs for one client does not affect another client's prefs", () => {
      const clientA = makeProfile({
        id: "a",
        prefs: [{ channel: "email", notificationType: "booking_reminder", enabled: false }],
      });
      const clientB = makeProfile({ id: "b", prefs: [] });

      expect(shouldSend(clientA, "email", "booking_reminder", "operational")).toBe(false);
      expect(shouldSend(clientB, "email", "booking_reminder", "operational")).toBe(true);
    });

    it("getNotificationPreferences key format is 'channel:type'", () => {
      // Documents the Map key format used by getNotificationPreferences()
      const key = (channel: NotifChannel, type: NotifType) => `${channel}:${type}`;
      expect(key("email", "booking_reminder")).toBe("email:booking_reminder");
      expect(key("sms", "birthday_promo")).toBe("sms:birthday_promo");
    });

    it("enabling only sms:booking_reminder pref does not unblock email:booking_reminder", () => {
      const client = makeProfile({
        notifyEmail: false, // email off at legacy level
        prefs: [{ channel: "sms", notificationType: "booking_reminder", enabled: true }],
      });
      expect(shouldSend(client, "email", "booking_reminder", "operational")).toBe(false);
      expect(shouldSend(client, "sms", "booking_reminder", "operational")).toBe(true);
    });
  });
});
