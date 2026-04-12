/**
 * Tests for the notification preference checking and seeding module.
 *
 * Covers:
 *  - isNotificationEnabled: returns true for enabled pref, false for disabled
 *  - isNotificationEnabled: defaults to enabled when no preference row exists
 *  - getNotificationPreferences: returns correct channel:type → enabled map
 *  - seedNotificationPreferences: creates rows for all channel/type combos
 *  - seedNotificationPreferences: skips when preferences already exist
 *  - setNotificationPreference: upserts a single preference row
 *  - Marketing and operational types follow the same pref-based logic
 *
 * Mocks: @/db (chainable query builder), @/db/schema, drizzle-orm.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ── Mock setup ─────────────────────────────────────────────────────────── */

let selectResult: unknown[] = [];

const mockLimit = vi.fn(() => Promise.resolve(selectResult));
const mockWhere = vi.fn(() => {
  const promise = Promise.resolve(selectResult);
  return Object.assign(promise, { limit: mockLimit });
});
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
const mockInsertValues = vi.fn(() => {
  const promise = Promise.resolve(undefined);
  return Object.assign(promise, { onConflictDoUpdate: mockOnConflictDoUpdate });
});
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

vi.mock("@/db/schema", () => ({
  notificationPreferences: {
    id: "id",
    profileId: "profileId",
    channel: "channel",
    notificationType: "notificationType",
    enabled: "enabled",
  },
  NOTIF_CHANNELS: ["email", "sms", "push"],
  NOTIF_TYPES: [
    "booking_reminder",
    "review_request",
    "booking_confirmation",
    "marketing",
  ],
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => val),
  and: vi.fn((...args: unknown[]) => args),
}));

import {
  isNotificationEnabled,
  getNotificationPreferences,
  seedNotificationPreferences,
  setNotificationPreference,
} from "./notification-preferences";

describe("lib/notification-preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResult = [];
  });

  // ── isNotificationEnabled ────────────────────────────────────────────────

  describe("isNotificationEnabled()", () => {
    it("returns true when the preference is enabled", async () => {
      selectResult = [{ enabled: true }];

      const result = await isNotificationEnabled("profile-1", "email", "booking_reminder");

      expect(result).toBe(true);
    });

    it("returns false when the preference is disabled", async () => {
      selectResult = [{ enabled: false }];

      const result = await isNotificationEnabled("profile-1", "email", "booking_reminder");

      expect(result).toBe(false);
    });

    it("defaults to true when no preference row exists", async () => {
      selectResult = [];

      const result = await isNotificationEnabled("profile-1", "sms", "review_request");

      expect(result).toBe(true);
    });

    it("queries with the correct profileId, channel, and type", async () => {
      selectResult = [{ enabled: true }];

      await isNotificationEnabled("profile-42", "push", "marketing");

      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(mockLimit).toHaveBeenCalledWith(1);
    });
  });

  // ── getNotificationPreferences ──────────────────────────────────────────

  describe("getNotificationPreferences()", () => {
    it("returns a map of channel:type keys to enabled values", async () => {
      selectResult = [
        { channel: "email", notificationType: "booking_reminder", enabled: true },
        { channel: "sms", notificationType: "booking_reminder", enabled: false },
        { channel: "email", notificationType: "marketing", enabled: false },
      ];

      const map = await getNotificationPreferences("profile-1");

      expect(map.get("email:booking_reminder")).toBe(true);
      expect(map.get("sms:booking_reminder")).toBe(false);
      expect(map.get("email:marketing")).toBe(false);
      expect(map.size).toBe(3);
    });

    it("returns an empty map when no preferences exist", async () => {
      selectResult = [];

      const map = await getNotificationPreferences("profile-1");

      expect(map.size).toBe(0);
    });
  });

  // ── seedNotificationPreferences ─────────────────────────────────────────

  describe("seedNotificationPreferences()", () => {
    it("inserts all channel × type rows when no preferences exist", async () => {
      selectResult = [];

      await seedNotificationPreferences("profile-new");

      expect(mockInsert).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            profileId: "profile-new",
            channel: "email",
            notificationType: "booking_reminder",
            enabled: true,
          }),
        ]),
      );
      // 3 channels × 4 types = 12 rows
      const rows = mockInsertValues.mock.calls[0][0] as unknown[];
      expect(rows).toHaveLength(12);
    });

    it("skips insert when preferences already exist", async () => {
      selectResult = [{ id: 1 }];

      await seedNotificationPreferences("profile-existing");

      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  // ── setNotificationPreference ───────────────────────────────────────────

  describe("setNotificationPreference()", () => {
    it("upserts a single preference row", async () => {
      await setNotificationPreference("profile-1", "email", "marketing", false);

      expect(mockInsert).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: "profile-1",
          channel: "email",
          notificationType: "marketing",
          enabled: false,
        }),
      );
      expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          set: { enabled: false },
        }),
      );
    });
  });

  // ── Marketing vs operational type behavior ──────────────────────────────

  describe("type-agnostic preference logic", () => {
    it("marketing type follows the same enabled/disabled pref logic", async () => {
      selectResult = [{ enabled: false }];
      expect(await isNotificationEnabled("p1", "email", "marketing")).toBe(false);

      selectResult = [{ enabled: true }];
      expect(await isNotificationEnabled("p1", "email", "marketing")).toBe(true);
    });

    it("operational type (booking_reminder) defaults to enabled when no pref exists", async () => {
      selectResult = [];
      expect(await isNotificationEnabled("p1", "sms", "booking_reminder")).toBe(true);
    });

    it("channel preference is independent per channel", async () => {
      // email disabled
      selectResult = [{ enabled: false }];
      expect(await isNotificationEnabled("p1", "email", "booking_reminder")).toBe(false);

      // sms enabled
      selectResult = [{ enabled: true }];
      expect(await isNotificationEnabled("p1", "sms", "booking_reminder")).toBe(true);
    });
  });
});
