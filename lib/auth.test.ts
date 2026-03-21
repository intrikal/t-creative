// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the auth helper module — getCurrentUser and isOnboardingComplete.
 *
 * Covers:
 *  - getCurrentUser: returns null when no session, returns user+profile when both
 *    exist, returns user with null profile when profile row is missing
 *  - isOnboardingComplete: checks whether profile has a non-empty firstName
 *
 * Mocks: Supabase auth (getUser), db (profile select), db/schema, drizzle-orm.
 */

// mockGetUser: controls the Supabase auth response — toggles between logged-in and anonymous
const mockGetUser = vi.fn();
// mockDbLimit: controls what profile row (if any) the DB returns
const mockDbLimit = vi.fn();

// Mock Supabase so tests don't need a real auth session
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}));

// Mock the database so tests don't need a real Postgres connection
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: mockDbLimit,
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  profiles: {},
}));

// Mock drizzle-orm eq() — the actual SQL comparison is irrelevant in unit tests
vi.mock("drizzle-orm", () => ({
  eq: vi.fn().mockReturnValue({}),
}));

describe("lib/auth", () => {
  // Reset mocks and default DB to return no profile rows
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockDbLimit.mockResolvedValue([]);
  });

  // Tests for getCurrentUser — the primary auth check used by server actions and API routes
  describe("getCurrentUser", () => {
    // No Supabase session — the user hasn't logged in
    it("returns null when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const { getCurrentUser } = await import("./auth");
      const result = await getCurrentUser();

      expect(result).toBeNull();
    });

    // Fully onboarded user — auth session + profile row both present
    it("returns user with profile when both exist", async () => {
      const fakeUser = { id: "user-1", email: "trini@example.com" };
      const fakeProfile = { id: "user-1", firstName: "Trini", role: "admin" };

      mockGetUser.mockResolvedValue({ data: { user: fakeUser } });
      mockDbLimit.mockResolvedValue([fakeProfile]);

      const { getCurrentUser } = await import("./auth");
      const result = await getCurrentUser();

      expect(result).toEqual({
        id: "user-1",
        email: "trini@example.com",
        profile: fakeProfile,
      });
    });

    // User logged in via Supabase but hasn't completed onboarding yet (no profile row)
    it("returns user with null profile when no profile row exists", async () => {
      const fakeUser = { id: "user-2", email: "new@example.com" };

      mockGetUser.mockResolvedValue({ data: { user: fakeUser } });
      mockDbLimit.mockResolvedValue([]);

      const { getCurrentUser } = await import("./auth");
      const result = await getCurrentUser();

      expect(result).toEqual({
        id: "user-2",
        email: "new@example.com",
        profile: null,
      });
    });
  });

  // Tests for the onboarding check — firstName is the minimum required field
  describe("isOnboardingComplete", () => {
    it("returns true when profile has a firstName", async () => {
      const { isOnboardingComplete } = await import("./auth");
      expect(isOnboardingComplete({ firstName: "Trini" } as never)).toBe(true);
    });

    it("returns false when profile is null", async () => {
      const { isOnboardingComplete } = await import("./auth");
      expect(isOnboardingComplete(null)).toBe(false);
    });

    it("returns false when firstName is an empty string", async () => {
      const { isOnboardingComplete } = await import("./auth");
      expect(isOnboardingComplete({ firstName: "" } as never)).toBe(false);
    });

    it("returns false when firstName is undefined", async () => {
      const { isOnboardingComplete } = await import("./auth");
      expect(isOnboardingComplete({ firstName: undefined } as never)).toBe(false);
    });
  });
});
