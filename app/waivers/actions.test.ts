// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions and spying on calls
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/waivers/actions.ts — Public waiver actions (token-authenticated).
 *
 * Covers:
 *  1. submitWaiverForm — signWaiver: inserts submission with formVersion and clientId
 *  2. getWaiverPageData — waiver required but not signed: returns pending forms
 *  3. submitWaiverForm — expired token: returns error without inserting
 *  4. submitWaiverForm — version mismatch: still accepted, stores server timestamp
 *  5. submitWaiverForm — already signed: idempotent, no re-insert
 *  6. submitWaiverForm — tracks waiver_completed audit event
 *
 * Mocks: @/db, @/db/schema, drizzle-orm, @/lib/posthog, @/lib/waiver-token.
 */

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

const mockTrackEvent = vi.fn();
const mockVerifyWaiverToken = vi.fn();

/* ------------------------------------------------------------------ */
/*  Mock setup                                                         */
/* ------------------------------------------------------------------ */

function setupMocks(dbOverrides: Record<string, unknown> | null = null) {
  const resolvedDb = makeDefaultDb();
  if (dbOverrides) Object.assign(resolvedDb, dbOverrides);

  vi.doMock("@/db", () => ({ db: resolvedDb }));
  vi.doMock("@/db/schema", () => ({
    bookings: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      startsAt: "startsAt",
    },
    services: { id: "id", name: "name", category: "category" },
    clientForms: {
      id: "id",
      name: "name",
      type: "type",
      appliesTo: "appliesTo",
      isActive: "isActive",
      required: "required",
      description: "description",
      fields: "fields",
    },
    formSubmissions: {
      id: "id",
      clientId: "clientId",
      formId: "formId",
      formVersion: "formVersion",
      data: "data",
      signatureUrl: "signatureUrl",
      ipAddress: "ipAddress",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/waiver-token", () => ({
    verifyWaiverToken: mockVerifyWaiverToken,
  }));
}

function makeDefaultDb() {
  const self: Record<string, unknown> = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };
  return self;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("app/waivers/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---- signWaiver ---- */

  describe("submitWaiverForm — signWaiver", () => {
    it("inserts a submission with formVersion (YYYY-MM) and correct clientId", async () => {
      vi.resetModules();
      mockVerifyWaiverToken.mockReturnValue({ bookingId: 1, clientId: "client-1" });
      const mockValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 10 }]),
      }));
      let selectCall = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeChain([{ id: 5, name: "Lash Consent" }]);
          // No duplicate submission
          return makeChain([]);
        }),
        insert: vi.fn(() => ({ values: mockValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitWaiverForm } = await import("@/app/waivers/actions");

      const result = await submitWaiverForm("valid.token", 5, {
        fullName: "Jane Doe",
        agreement: true,
      });

      expect(result.success).toBe(true);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "client-1",
          formId: 5,
          formVersion: expect.stringMatching(/^\d{4}-\d{2}$/),
          signatureUrl: null,
        }),
      );
    });
  });

  /* ---- waiver required but not signed ---- */

  describe("getWaiverPageData — waiver required but not signed", () => {
    it("returns pending forms that the client has not submitted", async () => {
      vi.resetModules();
      mockVerifyWaiverToken.mockReturnValue({ bookingId: 1, clientId: "client-1" });
      let selectCall = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCall++;
          // call 1: booking + service
          if (selectCall === 1) {
            return makeChain([
              {
                clientId: "client-1",
                serviceName: "Classic Lash Set",
                serviceCategory: "lash",
                startsAt: new Date("2026-04-01T14:00:00Z"),
              },
            ]);
          }
          // call 2: required active forms
          if (selectCall === 2) {
            return makeChain([
              {
                id: 5,
                name: "Lash Waiver",
                type: "waiver",
                description: "Liability waiver",
                appliesTo: ["Lash"],
                isActive: true,
                required: true,
                fields: null,
              },
              {
                id: 6,
                name: "Allergy Consent",
                type: "consent",
                description: null,
                appliesTo: ["All"],
                isActive: true,
                required: true,
                fields: null,
              },
            ]);
          }
          // call 3: existing submissions — none
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getWaiverPageData } = await import("@/app/waivers/actions");

      const result = await getWaiverPageData("valid.token");

      expect(result).not.toBeNull();
      expect(result!.clientId).toBe("client-1");
      expect(result!.bookingId).toBe(1);
      expect(result!.serviceName).toBe("Classic Lash Set");
      expect(result!.forms).toHaveLength(2);
      expect(result!.forms[0]).toMatchObject({ id: 5, name: "Lash Waiver", type: "waiver" });
      expect(result!.forms[1]).toMatchObject({ id: 6, name: "Allergy Consent", type: "consent" });
    });
  });

  /* ---- expired token ---- */

  describe("submitWaiverForm — expired token", () => {
    it("returns error without inserting when token is expired", async () => {
      vi.resetModules();
      mockVerifyWaiverToken.mockReturnValue(null);
      const mockInsert = vi.fn();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: mockInsert,
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitWaiverForm } = await import("@/app/waivers/actions");

      const result = await submitWaiverForm("expired.token", 5, { fullName: "Jane" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid or expired link");
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  /* ---- version mismatch ---- */

  describe("submitWaiverForm — version mismatch", () => {
    it("still accepts submission — formVersion is always server YYYY-MM", async () => {
      vi.resetModules();
      mockVerifyWaiverToken.mockReturnValue({ bookingId: 1, clientId: "client-1" });
      const mockValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 11 }]),
      }));
      let selectCall = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeChain([{ id: 5, name: "Consent Form" }]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({ values: mockValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitWaiverForm } = await import("@/app/waivers/actions");

      // Client sends data with an old form version hint — should be ignored
      const result = await submitWaiverForm("valid.token", 5, {
        fullName: "Jane Doe",
        _formVersion: "2024-01",
      });

      expect(result.success).toBe(true);
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          formVersion: expect.stringMatching(/^\d{4}-\d{2}$/),
        }),
      );
    });
  });

  /* ---- already signed (idempotent) ---- */

  describe("submitWaiverForm — already signed", () => {
    it("returns success without re-inserting for duplicate submission", async () => {
      vi.resetModules();
      mockVerifyWaiverToken.mockReturnValue({ bookingId: 1, clientId: "client-1" });
      let selectCall = 0;
      const mockInsert = vi.fn(() => ({
        values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
      }));
      setupMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeChain([{ id: 5, name: "Waiver" }]);
          // Duplicate found
          return makeChain([{ id: 99 }]);
        }),
        insert: mockInsert,
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitWaiverForm } = await import("@/app/waivers/actions");

      const result = await submitWaiverForm("valid.token", 5, { fullName: "Jane" });

      expect(result.success).toBe(true);
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  /* ---- audit log ---- */

  describe("submitWaiverForm — audit log", () => {
    it("tracks waiver_completed event with bookingId, formId, and formName", async () => {
      vi.resetModules();
      mockVerifyWaiverToken.mockReturnValue({ bookingId: 42, clientId: "client-2" });
      let selectCall = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeChain([{ id: 7, name: "Allergy Form" }]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitWaiverForm } = await import("@/app/waivers/actions");

      await submitWaiverForm("valid.token", 7, { fullName: "Bob" });

      expect(mockTrackEvent).toHaveBeenCalledWith("client-2", "waiver_completed", {
        bookingId: 42,
        formId: 7,
        formName: "Allergy Form",
      });
    });
  });

  /* ---- getWaiverPageData — expired token ---- */

  describe("getWaiverPageData — expired token", () => {
    it("returns null without hitting the DB", async () => {
      vi.resetModules();
      mockVerifyWaiverToken.mockReturnValue(null);
      const mockSelect = vi.fn();
      setupMocks({
        select: mockSelect,
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getWaiverPageData } = await import("@/app/waivers/actions");

      const result = await getWaiverPageData("expired.token");

      expect(result).toBeNull();
      expect(mockSelect).not.toHaveBeenCalled();
    });
  });
});
