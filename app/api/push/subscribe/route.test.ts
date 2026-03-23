/**
 * Tests for POST /api/push/subscribe and DELETE /api/push/subscribe.
 *
 * Covers:
 *  - POST happy path: new subscription inserted into push_subscriptions
 *  - POST duplicate endpoint: existing row updated, not duplicated
 *  - DELETE: subscription removed by endpoint
 *  - POST invalid payload: missing required fields → 400
 *  - POST/DELETE unauthenticated: getUser throws → 401
 *
 * Mocks: getUser (@/lib/auth), db (select/update/insert/delete chains),
 * pushSubscriptions schema, drizzle-orm operators.
 */
// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

const mockGetUser = vi.fn();
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbDelete = vi.fn();

/** Returns a thenable select chain with .from().where().limit() support. */
function makeSelectChain(result: unknown[] = []) {
  const promise = Promise.resolve(result);
  const chain: Record<string, unknown> = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockReturnValue(Promise.resolve(result)),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
  (chain.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  (chain.where as ReturnType<typeof vi.fn>).mockReturnValue(chain);
  return chain;
}

function buildDb() {
  return {
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => {
      mockDbInsert(...args);
      return { values: vi.fn().mockResolvedValue(undefined) };
    },
    update: (...args: unknown[]) => {
      mockDbUpdate(...args);
      return {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      };
    },
    delete: (...args: unknown[]) => {
      mockDbDelete(...args);
      return { where: vi.fn().mockResolvedValue(undefined) };
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

const VALID_SUBSCRIPTION = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: { p256dh: "key-abc", auth: "auth-xyz" },
  expirationTime: null,
};

describe("POST /api/push/subscribe", () => {
  let POST: (request: Request) => Promise<Response>;
  let DELETE: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockGetUser.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    // Default: no existing subscription
    mockDbSelect.mockReturnValue(makeSelectChain([]));

    vi.resetModules();

    vi.doMock("@/lib/auth", () => ({ getUser: mockGetUser }));
    vi.doMock("@/db", () => ({ db: buildDb() }));
    vi.doMock("@/db/schema", () => ({
      pushSubscriptions: {
        id: "id",
        profileId: "profileId",
        endpoint: "endpoint",
        p256dh: "p256dh",
        auth: "auth",
        expiresAt: "expiresAt",
      },
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn((_col: unknown, val: unknown) => val),
      and: vi.fn((...args: unknown[]) => args),
    }));

    const mod = await import("./route");
    POST = mod.POST;
    DELETE = mod.DELETE;
  });

  function makePost(body: unknown) {
    return new Request("https://example.com/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function makeDelete(body: unknown) {
    return new Request("https://example.com/api/push/subscribe", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  /* ---------- Happy path: new subscription ---------- */

  it("inserts a new subscription when endpoint does not exist", async () => {
    const res = await POST(makePost(VALID_SUBSCRIPTION));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(mockDbInsert).toHaveBeenCalledOnce();
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  /* ---------- Happy path: duplicate endpoint → update ---------- */

  it("updates keys when the same endpoint already exists for the user", async () => {
    mockDbSelect.mockReturnValue(makeSelectChain([{ id: "sub-42" }]));

    const res = await POST(makePost(VALID_SUBSCRIPTION));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(mockDbUpdate).toHaveBeenCalledOnce();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  /* ---------- DELETE: unsubscribe ---------- */

  it("deletes the subscription matching the endpoint", async () => {
    const res = await DELETE(makeDelete({ endpoint: VALID_SUBSCRIPTION.endpoint }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(mockDbDelete).toHaveBeenCalledOnce();
  });

  /* ---------- Validation ---------- */

  it("returns 400 when endpoint is missing from POST body", async () => {
    const res = await POST(makePost({ keys: { p256dh: "k", auth: "a" } }));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.any(String) });
  });

  it("returns 400 when keys are missing from POST body", async () => {
    const res = await POST(makePost({ endpoint: "https://push.example.com/sub/1" }));

    expect(res.status).toBe(400);
  });

  it("returns 400 when endpoint is not a valid URL", async () => {
    const res = await POST(makePost({ ...VALID_SUBSCRIPTION, endpoint: "not-a-url" }));

    expect(res.status).toBe(400);
  });

  /* ---------- Unauthenticated ---------- */

  it("returns 401 when getUser throws (POST)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Not authenticated"));

    const res = await POST(makePost(VALID_SUBSCRIPTION));

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Unauthorized" });
  });

  it("returns 401 when getUser throws (DELETE)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Not authenticated"));

    const res = await DELETE(makeDelete({ endpoint: VALID_SUBSCRIPTION.endpoint }));

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "Unauthorized" });
  });
});
