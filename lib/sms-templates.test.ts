/**
 * Tests for sms-templates — template rendering and variable substitution.
 *
 * Mocks the database layer to isolate template interpolation logic.
 *
 * @module lib/sms-templates.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ---- Mock DB ---- */

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return { from: mockFrom };
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn(),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  smsTemplates: {
    slug: "slug",
    name: "name",
    $inferSelect: {},
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => val),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (_fn: (...args: unknown[]) => unknown, _keys: string[], _opts: unknown) => _fn,
}));

/* ---- Fixtures ---- */

const bookingTemplate = {
  id: 1,
  slug: "booking-reminder",
  name: "Booking Reminder",
  description: "Sent 24h before appointment",
  body: "Hi {{clientFirstName}}! Your {{serviceName}} at {{businessName}} is {{startsAtFormatted}}.",
  variables: ["clientFirstName", "serviceName", "businessName", "startsAtFormatted"],
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const inactiveTemplate = {
  ...bookingTemplate,
  id: 2,
  slug: "birthday-promo",
  isActive: false,
};

/* ---- Setup ---- */

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });
  mockWhere.mockReturnValue({ limit: mockLimit });
  mockLimit.mockResolvedValue([bookingTemplate]);
  mockOrderBy.mockResolvedValue([bookingTemplate]);
});

/* ---- Lazy import (after mocks) ---- */

async function loadModule() {
  return await import("./sms-templates");
}

/* ---- Tests ---- */

describe("renderSmsTemplate", () => {
  it("replaces all variables with provided values", async () => {
    const { renderSmsTemplate } = await loadModule();
    const result = await renderSmsTemplate("booking-reminder", {
      clientFirstName: "Alice",
      serviceName: "Balayage",
      businessName: "T Creative",
      startsAtFormatted: "Fri 3pm",
    });

    expect(result).toBe("Hi Alice! Your Balayage at T Creative is Fri 3pm.");
  });

  it("returns null for inactive templates", async () => {
    mockLimit.mockResolvedValue([inactiveTemplate]);
    const { renderSmsTemplate } = await loadModule();
    const result = await renderSmsTemplate("birthday-promo", {
      firstName: "Bob",
    });

    expect(result).toBeNull();
  });

  it("leaves placeholder when variable value is missing", async () => {
    const { renderSmsTemplate } = await loadModule();
    const result = await renderSmsTemplate("booking-reminder", {
      clientFirstName: "Alice",
      // serviceName intentionally omitted
      businessName: "T Creative",
      startsAtFormatted: "Fri 3pm",
    });

    expect(result).toBe("Hi Alice! Your {{serviceName}} at T Creative is Fri 3pm.");
  });

  it("falls back to hardcoded default when DB row is missing", async () => {
    mockLimit.mockResolvedValue([]);
    const { renderSmsTemplate } = await loadModule();
    const result = await renderSmsTemplate("booking-reminder", {
      clientFirstName: "Alice",
      serviceName: "Balayage",
      businessName: "T Creative",
      startsAtFormatted: "Fri 3pm",
    });

    expect(result).toContain("Hi Alice!");
    expect(result).toContain("Balayage");
  });

  it("returns null for unknown slug with no DB row", async () => {
    mockLimit.mockResolvedValue([]);
    const { renderSmsTemplate } = await loadModule();
    const result = await renderSmsTemplate("nonexistent-template", {});

    expect(result).toBeNull();
  });
});

describe("getDefaultBody", () => {
  it("returns default for known slugs", async () => {
    const { getDefaultBody } = await loadModule();
    expect(getDefaultBody("booking-reminder")).toContain("{{clientFirstName}}");
    expect(getDefaultBody("birthday-promo")).toContain("{{firstName}}");
  });

  it("returns null for unknown slugs", async () => {
    const { getDefaultBody } = await loadModule();
    expect(getDefaultBody("unknown-template")).toBeNull();
  });
});
