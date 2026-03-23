// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions and spying on calls
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

/**
 * Returns an object that is both awaitable (thenable) and chainable.
 * Every builder method returns the same object so any call chain can be
 * awaited and will resolve to `rows`.
 */
function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    offset: () => chain,
    as: () => chain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

// mockGetUser simulates Supabase auth — tests set its return value to control authentication state.
const mockGetUser = vi.fn();
// Captures PostHog analytics events so tests verify correct tracking without hitting the real API.
const mockTrackEvent = vi.fn();
// Captures audit log writes for verifying create/update/delete actions are tracked.
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockRevalidatePath = vi.fn();

/* ------------------------------------------------------------------ */
/*  setupMocks                                                         */
/* ------------------------------------------------------------------ */

/**
 * Registers vi.doMock() calls for all external dependencies so the
 * imported server actions run against fakes instead of real services.
 *
 * @param db - Optional custom DB mock. Defaults to a sensible stub.
 * @param profileRole - Role returned by the profiles table select for the
 *   current user. "admin"/"assistant" → staff access granted; "client" →
 *   requireStaff throws Forbidden. Defaults to "admin".
 */
function setupMocks(
  db: Record<string, any> | null = null,
  profileRole: "admin" | "assistant" | "client" | null = "admin",
) {
  const defaultDb = {
    select: vi.fn(() => {
      // First select call in getCurrentUser is the profiles lookup for auth.
      // Return a row matching profileRole so requireStaff can check it.
      if (profileRole !== null) {
        return makeChain([{ role: profileRole }]);
      }
      return makeChain([]);
    }),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      role: "role",
    },
    clientNotes: {
      id: "id",
      profileId: "profileId",
      authorId: "authorId",
      type: "type",
      content: "content",
      isPinned: "isPinned",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    gte: vi.fn((...args: unknown[]) => ({ type: "gte", args })),
    lte: vi.fn((...args: unknown[]) => ({ type: "lte", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_table: unknown, name: string) => ({
      aliasName: name,
      id: `${name}_id`,
      firstName: `${name}_first`,
      lastName: `${name}_last`,
    })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({
      auth: { getUser: mockGetUser },
    })),
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("note-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "staff-1" } } });
  });

  /* ---- createClientNote ---- */

  describe("createClientNote", () => {
    it("stores type, content, and author on the inserted row", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 42 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([{ role: "admin" }])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createClientNote } = await import("./note-actions");
      const result = await createClientNote({
        profileId: "a0000000-0000-4000-8000-000000000001",
        type: "call",
        content: "Discussed upcoming appointment",
      });
      expect(result).toMatchObject({ success: true, data: { id: 42 } });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          authorId: "staff-1",
          type: "call",
          content: "Discussed upcoming appointment",
          profileId: "a0000000-0000-4000-8000-000000000001",
        }),
      );
    });

    it("returns success: false when schema validation fails", async () => {
      vi.resetModules();
      setupMocks();
      const { createClientNote } = await import("./note-actions");
      // Empty content violates min(1) constraint
      const result = await createClientNote({
        profileId: "a0000000-0000-4000-8000-000000000001",
        type: "note",
        content: "",
      });
      expect(result).toMatchObject({ success: false });
      expect((result as { success: false; error: string }).error).toBeTruthy();
    });

    it("fires PostHog client_note_created event", async () => {
      vi.resetModules();
      setupMocks();
      const { createClientNote } = await import("./note-actions");
      await createClientNote({
        profileId: "a0000000-0000-4000-8000-000000000001",
        type: "email",
        content: "Sent appointment reminder",
      });
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "staff-1",
        "client_note_created",
        expect.objectContaining({
          profileId: "a0000000-0000-4000-8000-000000000001",
          type: "email",
        }),
      );
    });

    it("revalidates the client detail path", async () => {
      vi.resetModules();
      setupMocks();
      const { createClientNote } = await import("./note-actions");
      await createClientNote({
        profileId: "a0000000-0000-4000-8000-000000000001",
        type: "note",
        content: "General note",
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        "/dashboard/clients/a0000000-0000-4000-8000-000000000001",
      );
    });
  });

  /* ---- updateClientNote (pin) ---- */

  describe("updateClientNote — pin", () => {
    it("sets is_pinned to true when isPinned: true is passed", async () => {
      vi.resetModules();
      const mockUpdateWhere = vi.fn();
      const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
      setupMocks({
        select: vi.fn(() => makeChain([{ role: "admin" }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateClientNote } = await import("./note-actions");
      const result = await updateClientNote(7, { isPinned: true });
      expect(result).toMatchObject({ success: true });
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ isPinned: true }));
    });

    it("logs 'Note pinned' description in audit log", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ role: "admin" }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateClientNote } = await import("./note-actions");
      await updateClientNote(7, { isPinned: true });
      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "update",
          entityType: "client_note",
          entityId: "7",
          description: "Note pinned",
        }),
      );
    });
  });

  /* ---- RLS: staff who served client can create; others cannot ---- */

  describe("RLS — role-based access", () => {
    it("staff (admin) can create a note", async () => {
      vi.resetModules();
      setupMocks(null, "admin");
      const { createClientNote } = await import("./note-actions");
      const result = await createClientNote({
        profileId: "a0000000-0000-4000-8000-000000000002",
        type: "note",
        content: "Admin note",
      });
      expect(result).toMatchObject({ success: true });
    });

    it("staff (assistant) can create a note", async () => {
      vi.resetModules();
      setupMocks(null, "assistant");
      const { createClientNote } = await import("./note-actions");
      const result = await createClientNote({
        profileId: "a0000000-0000-4000-8000-000000000002",
        type: "note",
        content: "Assistant note",
      });
      expect(result).toMatchObject({ success: true });
    });

    it("non-staff user (client role) is rejected with Forbidden", async () => {
      vi.resetModules();
      // profileRole "client" → requireStaff throws "Forbidden"
      setupMocks(null, "client");
      const { createClientNote } = await import("./note-actions");
      const result = await createClientNote({
        profileId: "a0000000-0000-4000-8000-000000000002",
        type: "note",
        content: "Should be rejected",
      });
      expect(result).toMatchObject({ success: false });
      expect((result as { success: false; error: string }).error).toMatch(/forbidden/i);
    });

    it("unauthenticated user is rejected", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks(null, null);
      const { createClientNote } = await import("./note-actions");
      const result = await createClientNote({
        profileId: "a0000000-0000-4000-8000-000000000002",
        type: "note",
        content: "Should be rejected",
      });
      expect(result).toMatchObject({ success: false });
    });
  });

  /* ---- Client cannot see notes ---- */

  describe("RLS — client cannot read notes", () => {
    it("getClientNotes throws Forbidden for a client-role user", async () => {
      vi.resetModules();
      // profileRole "client" → requireStaff throws "Forbidden"
      setupMocks(null, "client");
      const { getClientNotes } = await import("./note-actions");
      await expect(getClientNotes("a0000000-0000-4000-8000-000000000003")).rejects.toThrow(
        /forbidden/i,
      );
    });

    it("getPinnedNotes throws Forbidden for a client-role user", async () => {
      vi.resetModules();
      setupMocks(null, "client");
      const { getPinnedNotes } = await import("./note-actions");
      await expect(getPinnedNotes("a0000000-0000-4000-8000-000000000003")).rejects.toThrow(
        /forbidden/i,
      );
    });
  });

  /* ---- autoLogCommunication ---- */

  describe("autoLogCommunication", () => {
    it("stores the correct type and content when auto-logging an email", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        select: vi.fn(() => makeChain([{ role: "admin" }])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { autoLogCommunication } = await import("./note-actions");
      await autoLogCommunication({
        profileId: "a0000000-0000-4000-8000-000000000004",
        type: "email",
        content: "Booking confirmation — appointment_confirmation",
        authorId: "system-1",
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "email",
          content: "Booking confirmation — appointment_confirmation",
          profileId: "a0000000-0000-4000-8000-000000000004",
          authorId: "system-1",
        }),
      );
    });

    it("stores the correct type and content when auto-logging an sms", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        select: vi.fn(() => makeChain([{ role: "admin" }])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { autoLogCommunication } = await import("./note-actions");
      await autoLogCommunication({
        profileId: "a0000000-0000-4000-8000-000000000004",
        type: "sms",
        content: "Reminder: your appointment is tomorrow — appointment_reminder",
        authorId: "system-1",
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "sms",
          content: "Reminder: your appointment is tomorrow — appointment_reminder",
        }),
      );
    });

    it("is non-fatal: swallows insert errors silently", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn().mockRejectedValue(new Error("DB connection lost")),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { autoLogCommunication } = await import("./note-actions");
      // Must not throw — non-fatal helper
      await expect(
        autoLogCommunication({
          profileId: "a0000000-0000-4000-8000-000000000004",
          type: "email",
          content: "Will fail silently",
          authorId: "system-1",
        }),
      ).resolves.toBeUndefined();
    });
  });

  /* ---- deleteClientNote ---- */

  describe("deleteClientNote", () => {
    it("creates an audit log entry on deletion", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ role: "admin" }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { deleteClientNote } = await import("./note-actions");
      const result = await deleteClientNote(99);
      expect(result).toMatchObject({ success: true });
      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "staff-1",
          action: "delete",
          entityType: "client_note",
          entityId: "99",
          description: "Client note deleted",
        }),
      );
    });

    it("returns success: false and does not throw when unauthenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks(null, null);
      const { deleteClientNote } = await import("./note-actions");
      const result = await deleteClientNote(99);
      expect(result).toMatchObject({ success: false });
      expect(mockLogAction).not.toHaveBeenCalled();
    });
  });
});
