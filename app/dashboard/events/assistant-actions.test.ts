import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
// vi.mock factories are hoisted before imports, so all referenced variables
// must be created inside vi.hoisted().
const {
  mockAssignmentsResult,
  mockEventsResult,
  mockGuestsResult,
  selectCallCount,
  mockDb,
  mockGetCurrentUser,
} = vi.hoisted(() => {
  const mockAssignmentsResult = vi.fn<() => Promise<unknown[]>>();
  const mockEventsResult = vi.fn<() => Promise<unknown[]>>();
  const mockGuestsResult = vi.fn<() => Promise<unknown[]>>();
  // Mutable counter so we can distinguish which select() call we are in
  const selectCallCount = { value: 0 };

  // Helper: build a thenable chain that resolves to `resolver()`.
  // Supports .from().where().orderBy() and .from().where() with await.
  function makeSelectChain(resolver: () => Promise<unknown[]>) {
    const thenable = {
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
        resolver().then(resolve, reject),
    };
    const chain: Record<string, unknown> = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => thenable),
      // Awaiting the chain without .orderBy() also works via then:
      ...thenable,
    };
    return chain;
  }

  const mockDb = {
    select: vi.fn(() => {
      selectCallCount.value += 1;
      const n = selectCallCount.value;
      if (n === 1) return makeSelectChain(mockAssignmentsResult);
      if (n === 2) return makeSelectChain(mockEventsResult);
      return makeSelectChain(mockGuestsResult);
    }),
  };

  const mockGetCurrentUser = vi.fn();

  return {
    mockAssignmentsResult,
    mockEventsResult,
    mockGuestsResult,
    selectCallCount,
    mockDb,
    mockGetCurrentUser,
  };
});

vi.mock("@/db", () => ({ db: mockDb }));
vi.mock("@/db/schema", () => ({
  events: {},
  eventGuests: {},
  eventStaff: {},
  eventVenues: {},
  profiles: {},
}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => col),
  eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
  gte: vi.fn((a: unknown, b: unknown) => ({ a, b })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ col, vals })),
}));
vi.mock("@/lib/auth", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

import { getAssistantEvents } from "./assistant-actions";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const makeAssistantUser = () => ({
  id: "user-assistant-1",
  email: "assistant@example.com",
  profile: { role: "assistant" },
});

const makeAssignment = (eventId: number) => ({
  eventId,
  role: "photographer",
  notes: "Bring extra lenses",
});

const makeEvent = (id: number, status: string) => ({
  id,
  title: `Event ${id}`,
  eventType: "wedding",
  status,
  startsAt: new Date("2026-06-01"),
  endsAt: null,
  location: "Studio A",
  address: "123 Main St",
  equipmentNotes: null,
  maxAttendees: 50,
  description: null,
});

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("getAssistantEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallCount.value = 0;
  });

  // ── Auth checks ─────────────────────────────────────────────────────────────
  describe("auth", () => {
    it("throws when user is not authenticated", async () => {
      mockGetCurrentUser.mockResolvedValue(null);
      await expect(getAssistantEvents()).rejects.toThrow("Not authenticated");
    });

    it("throws when user role is not assistant", async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: "user-client-1",
        email: "client@example.com",
        profile: { role: "client" },
      });
      await expect(getAssistantEvents()).rejects.toThrow("Forbidden");
    });

    it("throws when profile is null", async () => {
      mockGetCurrentUser.mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        profile: null,
      });
      await expect(getAssistantEvents()).rejects.toThrow("Forbidden");
    });
  });

  // ── Empty results ────────────────────────────────────────────────────────────
  describe("empty results", () => {
    it("returns empty events array and zero stats when assistant has no assignments", async () => {
      mockGetCurrentUser.mockResolvedValue(makeAssistantUser());
      mockAssignmentsResult.mockResolvedValue([]);

      const result = await getAssistantEvents();

      expect(result.events).toEqual([]);
      expect(result.stats).toEqual({ upcoming: 0, completed: 0, total: 0 });
    });

    it("does not query events or guests when assignments are empty", async () => {
      mockGetCurrentUser.mockResolvedValue(makeAssistantUser());
      mockAssignmentsResult.mockResolvedValue([]);

      await getAssistantEvents();

      // Only one db.select call (assignments); events + guests skipped
      expect(mockDb.select).toHaveBeenCalledTimes(1);
    });
  });

  // ── Happy path ───────────────────────────────────────────────────────────────
  describe("happy path", () => {
    it("returns mapped events with guest counts and staff role", async () => {
      mockGetCurrentUser.mockResolvedValue(makeAssistantUser());
      mockAssignmentsResult.mockResolvedValue([makeAssignment(10)]);
      mockEventsResult.mockResolvedValue([makeEvent(10, "upcoming")]);
      mockGuestsResult.mockResolvedValue([{ eventId: 10 }, { eventId: 10 }, { eventId: 10 }]);

      const result = await getAssistantEvents();

      expect(result.events).toHaveLength(1);
      const event = result.events[0];
      expect(event.id).toBe(10);
      expect(event.guestCount).toBe(3);
      expect(event.role).toBe("photographer");
      expect(event.staffNotes).toBe("Bring extra lenses");
    });

    it("counts upcoming, completed, and total stats correctly", async () => {
      mockGetCurrentUser.mockResolvedValue(makeAssistantUser());
      mockAssignmentsResult.mockResolvedValue([
        makeAssignment(1),
        makeAssignment(2),
        makeAssignment(3),
        makeAssignment(4),
      ]);
      mockEventsResult.mockResolvedValue([
        makeEvent(1, "upcoming"),
        makeEvent(2, "confirmed"),
        makeEvent(3, "completed"),
        makeEvent(4, "cancelled"),
      ]);
      mockGuestsResult.mockResolvedValue([]);

      const { stats } = await getAssistantEvents();

      expect(stats.upcoming).toBe(2); // upcoming + confirmed
      expect(stats.completed).toBe(1);
      expect(stats.total).toBe(4);
    });

    it("counts in_progress status as upcoming", async () => {
      mockGetCurrentUser.mockResolvedValue(makeAssistantUser());
      mockAssignmentsResult.mockResolvedValue([makeAssignment(5)]);
      mockEventsResult.mockResolvedValue([makeEvent(5, "in_progress")]);
      mockGuestsResult.mockResolvedValue([]);

      const { stats } = await getAssistantEvents();

      expect(stats.upcoming).toBe(1);
    });

    it("sets guestCount to 0 for events with no guests", async () => {
      mockGetCurrentUser.mockResolvedValue(makeAssistantUser());
      mockAssignmentsResult.mockResolvedValue([makeAssignment(7)]);
      mockEventsResult.mockResolvedValue([makeEvent(7, "upcoming")]);
      mockGuestsResult.mockResolvedValue([]);

      const result = await getAssistantEvents();

      expect(result.events[0].guestCount).toBe(0);
    });

    it("sets role and staffNotes to null when assignment has no values", async () => {
      mockGetCurrentUser.mockResolvedValue(makeAssistantUser());
      mockAssignmentsResult.mockResolvedValue([{ eventId: 8, role: null, notes: null }]);
      mockEventsResult.mockResolvedValue([makeEvent(8, "upcoming")]);
      mockGuestsResult.mockResolvedValue([]);

      const result = await getAssistantEvents();

      expect(result.events[0].role).toBeNull();
      expect(result.events[0].staffNotes).toBeNull();
    });

    it("handles multiple events with mixed guest counts", async () => {
      mockGetCurrentUser.mockResolvedValue(makeAssistantUser());
      mockAssignmentsResult.mockResolvedValue([makeAssignment(20), makeAssignment(21)]);
      mockEventsResult.mockResolvedValue([makeEvent(20, "upcoming"), makeEvent(21, "completed")]);
      mockGuestsResult.mockResolvedValue([{ eventId: 20 }, { eventId: 20 }, { eventId: 21 }]);

      const result = await getAssistantEvents();

      const e20 = result.events.find((e) => e.id === 20)!;
      const e21 = result.events.find((e) => e.id === 21)!;
      expect(e20.guestCount).toBe(2);
      expect(e21.guestCount).toBe(1);
    });
  });

  // ── Error handling ───────────────────────────────────────────────────────────
  describe("error handling", () => {
    it("propagates db error from assignments query", async () => {
      mockGetCurrentUser.mockResolvedValue(makeAssistantUser());
      mockAssignmentsResult.mockRejectedValue(new Error("DB connection lost"));

      await expect(getAssistantEvents()).rejects.toThrow("DB connection lost");
    });

    it("propagates db error from events query", async () => {
      mockGetCurrentUser.mockResolvedValue(makeAssistantUser());
      mockAssignmentsResult.mockResolvedValue([makeAssignment(10)]);
      mockEventsResult.mockRejectedValue(new Error("Timeout"));

      await expect(getAssistantEvents()).rejects.toThrow("Timeout");
    });

    it("propagates db error from guests query", async () => {
      mockGetCurrentUser.mockResolvedValue(makeAssistantUser());
      mockAssignmentsResult.mockResolvedValue([makeAssignment(10)]);
      mockEventsResult.mockResolvedValue([makeEvent(10, "upcoming")]);
      mockGuestsResult.mockRejectedValue(new Error("Guest query failed"));

      await expect(getAssistantEvents()).rejects.toThrow("Guest query failed");
    });
  });
});
