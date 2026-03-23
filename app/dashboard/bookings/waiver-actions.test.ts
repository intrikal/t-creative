// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions and spying on calls
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

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

const mockGetUser = vi.fn();
const mockTrackEvent = vi.fn();
const mockVerifyWaiverToken = vi.fn();
const mockGetPublicBookingRules = vi.fn();
const mockGetPublicBusinessProfile = vi.fn();
const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockGetEmailRecipient = vi.fn();
const mockGenerateWaiverToken = vi.fn().mockReturnValue("test-token");

/* ------------------------------------------------------------------ */
/*  Mock setup helpers                                                 */
/* ------------------------------------------------------------------ */

function setupWaiverActionsMocks(overrides: Record<string, unknown> | null = null) {
  const resolvedDb = makeDefaultDb();
  if (overrides) Object.assign(resolvedDb, overrides);
  vi.doMock("@/db", () => ({ db: resolvedDb }));
  vi.doMock("@/db/schema", () => ({
    bookings: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      status: "status",
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
    },
    formSubmissions: {
      id: "id",
      clientId: "clientId",
      formId: "formId",
      formVersion: "formVersion",
      data: "data",
      signatureUrl: "signatureUrl",
      ipAddress: "ipAddress",
      submittedAt: "submittedAt",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      phone: "phone",
      role: "role",
      notifyEmail: "notifyEmail",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_table: unknown, name: string) => ({ _alias: name })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: mockGetEmailRecipient,
  }));
  vi.doMock("@/lib/waiver-token", () => ({
    generateWaiverToken: mockGenerateWaiverToken,
    verifyWaiverToken: mockVerifyWaiverToken,
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPublicBookingRules: mockGetPublicBookingRules,
    getPublicBusinessProfile: mockGetPublicBusinessProfile,
  }));
  vi.doMock("@/emails/WaiverRequired", () => ({
    WaiverRequired: vi.fn(() => null),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
}

// Separate setup for app/waivers/actions.ts (token-authenticated, no getUser)
function setupPublicWaiverMocks(overrides: Record<string, unknown> | null = null) {
  const resolvedDb = makeDefaultDb();
  if (overrides) Object.assign(resolvedDb, overrides);
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
    generateWaiverToken: mockGenerateWaiverToken,
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

describe("waiver-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockGetPublicBookingRules.mockResolvedValue({ waiverTokenExpiryDays: 7 });
    mockGetPublicBusinessProfile.mockResolvedValue({ businessName: "Test Salon" });
  });

  /* ---- checkBookingWaivers ---- */

  describe("checkBookingWaivers", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupWaiverActionsMocks();
      const { checkBookingWaivers } = await import("@/app/dashboard/bookings/waiver-actions");
      await expect(checkBookingWaivers(1)).rejects.toThrow("Not authenticated");
    });

    it("waiver required but not signed: returns passed=false with missing forms", async () => {
      vi.resetModules();
      let selectCall = 0;
      setupWaiverActionsMocks({
        select: vi.fn(() => {
          selectCall++;
          // call 1: getUser() profile lookup inside lib/auth.ts
          if (selectCall === 1) return makeChain([{ id: "user-1", role: "staff" }]);
          // call 2: booking + service category lookup
          if (selectCall === 2)
            return makeChain([{ clientId: "client-1", serviceCategory: "lash" }]);
          // call 3: required active forms
          if (selectCall === 3)
            return makeChain([
              { id: 5, name: "Lash Consent Form", type: "consent", appliesTo: ["Lash"] },
            ]);
          // call 4: submissions — client has not signed anything
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { checkBookingWaivers } = await import("@/app/dashboard/bookings/waiver-actions");

      const result = await checkBookingWaivers(1);

      expect(result.passed).toBe(false);
      expect(result.missing).toHaveLength(1);
      expect(result.missing[0]).toMatchObject({
        formId: 5,
        formName: "Lash Consent Form",
        formType: "consent",
      });
    });

    it("returns passed=true when client has already signed all required forms", async () => {
      vi.resetModules();
      let selectCall = 0;
      setupWaiverActionsMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeChain([{ id: "user-1", role: "staff" }]);
          if (selectCall === 2)
            return makeChain([{ clientId: "client-1", serviceCategory: "lash" }]);
          if (selectCall === 3)
            return makeChain([
              { id: 5, name: "Lash Consent Form", type: "consent", appliesTo: ["Lash"] },
            ]);
          // client already submitted form 5
          return makeChain([{ formId: 5 }]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { checkBookingWaivers } = await import("@/app/dashboard/bookings/waiver-actions");

      const result = await checkBookingWaivers(1);

      expect(result.passed).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it("returns passed=true when no forms apply to the service category", async () => {
      vi.resetModules();
      let selectCall = 0;
      setupWaiverActionsMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeChain([{ id: "user-1", role: "staff" }]);
          if (selectCall === 2)
            return makeChain([{ clientId: "client-1", serviceCategory: "massage" }]);
          // No required forms for this category
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { checkBookingWaivers } = await import("@/app/dashboard/bookings/waiver-actions");

      const result = await checkBookingWaivers(1);

      expect(result.passed).toBe(true);
      expect(result.missing).toHaveLength(0);
    });
  });

  /* ---- sendWaiverLink ---- */

  describe("sendWaiverLink", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupWaiverActionsMocks();
      const { sendWaiverLink } = await import("@/app/dashboard/bookings/waiver-actions");
      await expect(sendWaiverLink(1)).rejects.toThrow("Not authenticated");
    });

    it("throws when booking is not found", async () => {
      vi.resetModules();
      let selectCall = 0;
      setupWaiverActionsMocks({
        select: vi.fn(() => {
          selectCall++;
          // call 1: getUser() profile lookup; call 2+: booking lookup → empty
          if (selectCall === 1) return makeChain([{ id: "user-1", role: "staff" }]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { sendWaiverLink } = await import("@/app/dashboard/bookings/waiver-actions");
      await expect(sendWaiverLink(999)).rejects.toThrow("Booking not found");
    });

    it("throws when client has no email or notifications disabled", async () => {
      vi.resetModules();
      mockGetEmailRecipient.mockResolvedValue(null);
      let selectCall = 0;
      setupWaiverActionsMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeChain([{ id: "user-1", role: "staff" }]);
          return makeChain([
            {
              clientId: "client-1",
              serviceName: "Classic Lash Set",
              startsAt: new Date("2026-04-01T14:00:00Z"),
            },
          ]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { sendWaiverLink } = await import("@/app/dashboard/bookings/waiver-actions");
      await expect(sendWaiverLink(1)).rejects.toThrow(
        "Client has no email or notifications disabled",
      );
    });

    it("sends waiver email and returns true on success", async () => {
      vi.resetModules();
      mockGetEmailRecipient.mockResolvedValue({
        email: "jane@example.com",
        firstName: "Jane",
      });
      let selectCall = 0;
      setupWaiverActionsMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeChain([{ id: "user-1", role: "staff" }]);
          return makeChain([
            {
              clientId: "client-1",
              serviceName: "Classic Lash Set",
              startsAt: new Date("2026-04-01T14:00:00Z"),
            },
          ]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { sendWaiverLink } = await import("@/app/dashboard/bookings/waiver-actions");

      const result = await sendWaiverLink(1);

      expect(result).toBe(true);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "jane@example.com",
          entityType: "waiver_required",
          subject: expect.stringContaining("Classic Lash Set"),
        }),
      );
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Public waiver actions (app/waivers/actions.ts)                    */
/*  Token-authenticated — no Supabase session required                */
/* ------------------------------------------------------------------ */

describe("public waiver actions (app/waivers/actions.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---- submitWaiverForm ---- */

  describe("submitWaiverForm", () => {
    it("waiver token expired: returns error without inserting", async () => {
      vi.resetModules();
      // verifyWaiverToken returns null for expired/invalid tokens
      mockVerifyWaiverToken.mockReturnValue(null);
      setupPublicWaiverMocks();
      const { submitWaiverForm } = await import("@/app/waivers/actions");

      const result = await submitWaiverForm("expired.token", 5, { fullName: "Jane" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid or expired link");
    });

    it("waiver signed: inserts submission with formVersion and correct clientId", async () => {
      vi.resetModules();
      mockVerifyWaiverToken.mockReturnValue({ bookingId: 1, clientId: "client-1" });
      const mockValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 10 }]),
      }));
      let selectCall = 0;
      setupPublicWaiverMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) {
            // form existence check
            return makeChain([{ id: 5, name: "Lash Consent Form" }]);
          }
          // duplicate submission check — none
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
          // formVersion is set to current YYYY-MM regardless of what the form defines
          formVersion: expect.stringMatching(/^\d{4}-\d{2}$/),
        }),
      );
    });

    it("waiver version mismatch: still accepted — stores the version at submission time", async () => {
      vi.resetModules();
      mockVerifyWaiverToken.mockReturnValue({ bookingId: 1, clientId: "client-1" });
      const mockValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 11 }]),
      }));
      let selectCall = 0;
      setupPublicWaiverMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1)
            // Form is active — client is signing an older version
            return makeChain([{ id: 5, name: "Lash Consent Form" }]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({ values: mockValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitWaiverForm } = await import("@/app/waivers/actions");

      // Client submits with data referencing an old form version — still succeeds
      const result = await submitWaiverForm("valid.token", 5, {
        fullName: "Jane Doe",
        agreement: true,
        _formVersion: "2024-01", // client-supplied version hint (ignored)
      });

      expect(result.success).toBe(true);
      // The stored formVersion is always the server's current YYYY-MM, not what
      // the client sent — the schema records what was agreed to at submission time.
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          formVersion: expect.stringMatching(/^\d{4}-\d{2}$/),
        }),
      );
    });

    it("idempotent: returns success without re-inserting for duplicate submission", async () => {
      vi.resetModules();
      mockVerifyWaiverToken.mockReturnValue({ bookingId: 1, clientId: "client-1" });
      let selectCall = 0;
      const mockInsert = vi.fn(() => ({
        values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
      }));
      setupPublicWaiverMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeChain([{ id: 5, name: "Lash Consent Form" }]);
          // duplicate found — client already submitted this form
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

    it("tracks waiver_completed event after successful submission", async () => {
      vi.resetModules();
      mockVerifyWaiverToken.mockReturnValue({ bookingId: 42, clientId: "client-2" });
      let selectCall = 0;
      setupPublicWaiverMocks({
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

  /* ---- getWaiverPageData ---- */

  describe("getWaiverPageData", () => {
    it("waiver token expired: returns null without hitting the DB", async () => {
      vi.resetModules();
      mockVerifyWaiverToken.mockReturnValue(null);
      const mockSelect = vi.fn();
      setupPublicWaiverMocks({
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

    it("returns null when booking clientId does not match token clientId", async () => {
      vi.resetModules();
      mockVerifyWaiverToken.mockReturnValue({ bookingId: 1, clientId: "client-A" });
      let selectCall = 0;
      setupPublicWaiverMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) {
            // booking belongs to a different client
            return makeChain([
              {
                clientId: "client-B",
                serviceName: "Haircut",
                serviceCategory: "hair",
                startsAt: new Date(),
              },
            ]);
          }
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

      expect(result).toBeNull();
    });
  });
});
