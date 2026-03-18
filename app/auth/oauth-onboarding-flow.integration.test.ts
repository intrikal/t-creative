import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for GET /auth/callback — OAuth onboarding flow.
 *
 * Tests the full callback sequence: code exchange → profile lookup →
 * admin/assistant promotion → deactivation check → onboarding redirect.
 *
 * Uses vi.doMock + vi.resetModules per test so each test gets a freshly
 * imported route with isolated mock state.
 */

/* ------------------------------------------------------------------ */
/*  Shared mock handles                                                */
/* ------------------------------------------------------------------ */

const mockExchangeCode = vi.fn();
const mockGetUser = vi.fn();
const mockSignOut = vi.fn();
const mockVerifyInviteToken = vi.fn();

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const _profiles: MockRow[] = [];

  let nextId = 1;

  const selectQueue: Array<MockRow[]> = [];
  let selectIndex = 0;

  function makeChain(rows: MockRow[]) {
    const p = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      leftJoin: () => chain,
      innerJoin: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      returning: vi.fn().mockResolvedValue(rows.map((r) => ({ id: r.id ?? nextId++ }))),
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return chain;
  }

  const db = {
    _profiles,

    _queue: (rows: MockRow[]) => selectQueue.push(rows),
    _resetQueue: () => {
      selectQueue.length = 0;
      selectIndex = 0;
    },
    _seedProfile: (profile: MockRow) => _profiles.push(profile),

    select: vi.fn(() => {
      const rows = selectQueue[selectIndex++] ?? [];
      return makeChain(rows);
    }),

    insert: vi.fn((_table: any) => ({
      values: vi.fn((values: MockRow) => {
        const id = (values.id as number) ?? nextId++;
        const row = { ...values, id };
        if ("email" in values || "firstName" in values || "role" in values) {
          _profiles.push(row);
        }
        return {
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          returning: vi.fn().mockResolvedValue([{ id }]),
        };
      }),
    })),

    update: vi.fn((_table: any) => ({
      set: vi.fn((values: MockRow) => ({
        where: vi.fn().mockImplementation(() => {
          if ("role" in values) {
            const profile = _profiles[_profiles.length - 1];
            if (profile) {
              Object.assign(profile, values);
            }
          }
          return Promise.resolve(undefined);
        }),
      })),
    })),

    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),

    transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => {
      await fn(db);
    }),
  };

  return db;
}

/* ------------------------------------------------------------------ */
/*  Mock setup helper                                                  */
/* ------------------------------------------------------------------ */

function setupMocks(
  db: ReturnType<typeof createStatefulDb>,
  overrides: {
    isOnboardingComplete?: boolean;
  } = {},
) {
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
      auth: {
        exchangeCodeForSession: mockExchangeCode,
        getUser: mockGetUser,
        signOut: mockSignOut,
      },
    }),
  }));

  vi.doMock("@/db", () => ({ db }));

  vi.doMock("@/db/schema", () => ({
    profiles: {
      id: "id",
      role: "role",
      firstName: "firstName",
      email: "email",
      isActive: "isActive",
      isVip: "isVip",
      source: "source",
      onboardingData: "onboardingData",
      createdAt: "createdAt",
    },
  }));

  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    sql: Object.assign(vi.fn((...args: unknown[]) => ({ type: "sql", args })), {
      join: vi.fn(() => ({ type: "sql_join" })),
    }),
    ilike: vi.fn((...args: unknown[]) => ({ type: "ilike", args })),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  }));

  vi.doMock("@/lib/invite", () => ({
    verifyInviteToken: mockVerifyInviteToken,
    createInviteToken: vi.fn(),
  }));

  vi.doMock("@/lib/posthog", () => ({
    identifyUser: vi.fn(),
    trackEvent: vi.fn(),
  }));

  vi.doMock("@/lib/zoho", () => ({
    upsertZohoContact: vi.fn(),
  }));

  vi.doMock("@/lib/auth", () => ({
    isOnboardingComplete: vi
      .fn()
      .mockReturnValue(overrides.isOnboardingComplete ?? true),
    requireAdmin: vi.fn(),
  }));
}

/* ------------------------------------------------------------------ */
/*  Request factory                                                    */
/* ------------------------------------------------------------------ */

function makeCallbackRequest(params: Record<string, string> = {}) {
  const url = new URL("https://example.com/auth/callback");
  url.searchParams.set("code", params.code ?? "test-code-123");
  if (params.invite) url.searchParams.set("invite", params.invite);
  return new Request(url.toString());
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("GET /auth/callback — OAuth onboarding flow integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: code exchange succeeds, no error
    mockExchangeCode.mockResolvedValue({ error: null });
    // Default: getUser returns a regular user
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "user@example.com" } },
    });
    mockSignOut.mockResolvedValue({});
    mockVerifyInviteToken.mockResolvedValue(null);
  });

  /* ---------------------------------------------------------------- */
  it("redirects to /auth/error when no code provided", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    const { GET } = await import("@/app/auth/callback/route");

    // Build a request with no code param
    const url = new URL("https://example.com/auth/callback");
    const request = new Request(url.toString());

    const response = await GET(request);

    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    expect(location).toContain("auth/error");
  });

  /* ---------------------------------------------------------------- */
  it("redirects to /auth/error when exchangeCodeForSession fails", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);

    mockExchangeCode.mockResolvedValue({ error: { message: "invalid" } });

    const { GET } = await import("@/app/auth/callback/route");

    const response = await GET(makeCallbackRequest());

    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    expect(location).toContain("auth/error");
  });

  /* ---------------------------------------------------------------- */
  it("promotes user to admin role when email is in ADMIN_EMAILS", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const profile = { id: "admin-user", role: "client", isActive: true };
    db._seedProfile(profile);
    db._queue([profile]);

    setupMocks(db);

    mockGetUser.mockResolvedValue({
      data: { user: { id: "admin-user", email: "alvinwquach@gmail.com" } },
    });

    const { GET } = await import("@/app/auth/callback/route");

    await GET(makeCallbackRequest());

    expect(db._profiles[0].role).toBe("admin");
  });

  /* ---------------------------------------------------------------- */
  it("promotes user to assistant role via invite token", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const profile = { id: "user-1", role: "client", isActive: true };
    db._seedProfile(profile);
    db._queue([profile]);

    setupMocks(db);

    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "new@example.com" } },
    });
    mockVerifyInviteToken.mockResolvedValue({
      email: "new@example.com",
      role: "assistant",
    });

    const { GET } = await import("@/app/auth/callback/route");

    await GET(makeCallbackRequest({ invite: "some-token" }));

    expect(db._profiles[0].role).toBe("assistant");
  });

  /* ---------------------------------------------------------------- */
  it("redirects to /suspended when profile is deactivated", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const profile = { id: "user-1", role: "client", isActive: false };
    db._seedProfile(profile);
    db._queue([profile]);

    setupMocks(db);

    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "banned@example.com" } },
    });

    const { GET } = await import("@/app/auth/callback/route");

    const response = await GET(makeCallbackRequest());

    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    expect(location).toContain("suspended");
  });

  /* ---------------------------------------------------------------- */
  it("redirects to onboarding when isOnboardingComplete returns false", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const profile = { id: "user-1", role: "client", isActive: true, onboardingData: null };
    db._seedProfile(profile);
    db._queue([profile]);

    setupMocks(db, { isOnboardingComplete: false });

    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "new-client@example.com" } },
    });

    const { GET } = await import("@/app/auth/callback/route");

    const response = await GET(makeCallbackRequest());

    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    expect(location).toContain("onboarding");
  });
});
