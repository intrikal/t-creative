import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockDbLimit = vi.fn();

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}));

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

vi.mock("drizzle-orm", () => ({
  eq: vi.fn().mockReturnValue({}),
}));

describe("lib/auth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockDbLimit.mockResolvedValue([]);
  });

  describe("getCurrentUser", () => {
    it("returns null when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const { getCurrentUser } = await import("./auth");
      const result = await getCurrentUser();

      expect(result).toBeNull();
    });

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
