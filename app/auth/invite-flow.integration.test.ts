import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for the invite flow.
 *
 * Tests POST /api/invites against a stateful mock DB to verify the full
 * sequence: auth check → profile role lookup → token generation → email send.
 *
 * Unlike the unit tests in app/api/invites/route.test.ts (which mock
 * getCurrentUser wholesale), these tests mock at the Supabase + DB layer so
 * the real getCurrentUser runs and performs its profile SELECT.
 */

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

    select: vi.fn(() => {
      const rows = selectQueue[selectIndex++] ?? [];
      return makeChain(rows);
    }),

    insert: vi.fn((_table: any) => ({
      values: vi.fn((values: MockRow) => {
        const id = nextId++;
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
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
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
/*  Shared external mocks                                              */
/* ------------------------------------------------------------------ */

const mockGetUser = vi.fn();
const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockCreateInviteToken = vi.fn().mockResolvedValue("test-token-jwt");
const mockVerifyInviteToken = vi.fn();

/* ------------------------------------------------------------------ */
/*  Per-test setup helper                                              */
/* ------------------------------------------------------------------ */

function setupMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));

  vi.doMock("@/db/schema", () => ({
    profiles: {
      id: "id",
      role: "role",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
    },
  }));

  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    sql: Object.assign(vi.fn((...args: unknown[]) => ({ type: "sql", args })), {
      join: vi.fn(() => ({ type: "sql_join" })),
    }),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  }));

  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({
      auth: { getUser: mockGetUser },
    })),
  }));

  vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
  vi.doMock("@/lib/invite", () => ({
    createInviteToken: mockCreateInviteToken,
    verifyInviteToken: mockVerifyInviteToken,
  }));
  vi.doMock("@/emails/InviteEmail", () => ({
    InviteEmail: vi.fn().mockReturnValue(null),
  }));
}

/* ------------------------------------------------------------------ */
/*  Request factory                                                    */
/* ------------------------------------------------------------------ */

function makePost(body: unknown) {
  return new Request("https://example.com/api/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("POST /api/invites — invite flow integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1", email: "admin@example.com" } } });
    mockSendEmail.mockResolvedValue(true);
    mockCreateInviteToken.mockResolvedValue("test-token-jwt");
    process.env.NEXT_PUBLIC_SITE_URL = "https://studio.example.com";
  });

  /* ---------------------------------------------------------------- */
  it("returns 403 when user is not admin", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // getCurrentUser: getUser → user, then SELECT profile → client role
    db._queue([{ id: "user-1", role: "client", firstName: "Bob", email: "bob@example.com" }]);

    setupMocks(db);
    const { POST } = await import("@/app/api/invites/route");

    const res = await POST(makePost({ email: "new@example.com" }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({ error: "Forbidden" });
  });

  /* ---------------------------------------------------------------- */
  it("returns inviteUrl when admin sends invite", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // getCurrentUser: SELECT profile → admin role
    db._queue([{ id: "admin-1", role: "admin", firstName: "Admin", email: "admin@example.com" }]);

    setupMocks(db);
    const { POST } = await import("@/app/api/invites/route");

    const res = await POST(makePost({ email: "new@example.com" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("inviteUrl");
    expect(body.inviteUrl).toMatch(/login\?invite=/);
    expect(body.inviteUrl).toContain("test-token-jwt");
  });

  /* ---------------------------------------------------------------- */
  it("sends an invite email to the provided address", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // getCurrentUser: SELECT profile → admin role
    db._queue([{ id: "admin-1", role: "admin", firstName: "Admin", email: "admin@example.com" }]);

    setupMocks(db);
    const { POST } = await import("@/app/api/invites/route");

    await POST(makePost({ email: "new@example.com" }));

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "new@example.com",
      }),
    );
  });

  /* ---------------------------------------------------------------- */
  it("calls createInviteToken with the recipient email", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._queue([{ id: "admin-1", role: "admin", firstName: "Admin", email: "admin@example.com" }]);

    setupMocks(db);
    const { POST } = await import("@/app/api/invites/route");

    await POST(makePost({ email: "invited@example.com" }));

    expect(mockCreateInviteToken).toHaveBeenCalledWith("invited@example.com");
  });

  /* ---------------------------------------------------------------- */
  it("returns 403 when the authenticated user has no profile row", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // getUser returns a user but SELECT profile → empty (no row yet)
    db._queue([]);

    setupMocks(db);
    const { POST } = await import("@/app/api/invites/route");

    const res = await POST(makePost({ email: "new@example.com" }));

    expect(res.status).toBe(403);
  });

  /* ---------------------------------------------------------------- */
  it("returns 400 when email is missing from the request body", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._queue([{ id: "admin-1", role: "admin", firstName: "Admin", email: "admin@example.com" }]);

    setupMocks(db);
    const { POST } = await import("@/app/api/invites/route");

    const res = await POST(makePost({}));

    expect(res.status).toBe(400);
  });

  /* ---------------------------------------------------------------- */
  it("inviteUrl embeds the token returned by createInviteToken", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._queue([{ id: "admin-1", role: "admin", firstName: "Admin", email: "admin@example.com" }]);

    mockCreateInviteToken.mockResolvedValueOnce("unique-jwt-abc123");

    setupMocks(db);
    const { POST } = await import("@/app/api/invites/route");

    const res = await POST(makePost({ email: "staff@example.com" }));
    const body = await res.json();

    expect(body.inviteUrl).toContain("unique-jwt-abc123");
    expect(body.inviteUrl).toBe("https://studio.example.com/login?invite=unique-jwt-abc123");
  });
});
