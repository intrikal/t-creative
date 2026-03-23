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
    returning: vi.fn().mockResolvedValue(rows),
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

const mockRequireAdmin = vi.fn();
const mockGetUser = vi.fn();
const mockRevalidatePath = vi.fn();
const mockTrackEvent = vi.fn();

/* ------------------------------------------------------------------ */
/*  Mock setup helper                                                  */
/* ------------------------------------------------------------------ */

function setupMocks(overrides: Record<string, unknown> | null = null) {
  const resolvedDb = makeDefaultDb();
  if (overrides) Object.assign(resolvedDb, overrides);
  vi.doMock("@/db", () => ({ db: resolvedDb }));
  vi.doMock("@/db/schema", () => ({
    intakeFormDefinitions: {
      id: "id",
      serviceId: "serviceId",
      name: "name",
      description: "description",
      fields: "fields",
      version: "version",
      isActive: "isActive",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    intakeFormSubmissions: {
      id: "id",
      bookingId: "bookingId",
      formDefinitionId: "formDefinitionId",
      clientId: "clientId",
      responses: "responses",
      formVersion: "formVersion",
      submittedAt: "submittedAt",
    },
    services: { id: "id", name: "name" },
    profiles: { id: "id", firstName: "firstName", lastName: "lastName", email: "email" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/lib/auth", () => ({
    requireAdmin: mockRequireAdmin,
    getUser: mockGetUser,
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
}

function makeDefaultDb() {
  const self: Record<string, unknown> = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };
  return self;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("intake-form-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
    mockGetUser.mockResolvedValue({ id: "user-1" });
  });

  /* ---- createIntakeFormDefinition ---- */

  describe("createIntakeFormDefinition", () => {
    it("stores fields with correct labels, types, and required flags", async () => {
      vi.resetModules();
      const mockValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([
          {
            id: 1,
            serviceId: 10,
            name: "New Client Intake",
            description: null,
            fields: [
              { id: "f1", label: "Full Name", type: "text", required: true },
              { id: "f2", label: "Allergies", type: "textarea", required: false },
            ],
            version: 1,
            isActive: true,
          },
        ]),
      }));
      setupMocks({
        insert: vi.fn(() => ({ values: mockValues })),
      });
      const { createIntakeFormDefinition } =
        await import("@/app/dashboard/services/intake-form-actions");

      const result = await createIntakeFormDefinition({
        serviceId: 10,
        name: "New Client Intake",
        fields: [
          { id: "f1", label: "Full Name", type: "text", required: true },
          { id: "f2", label: "Allergies", type: "textarea", required: false },
        ],
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: 10,
          name: "New Client Intake",
          fields: [
            { id: "f1", label: "Full Name", type: "text", required: true },
            { id: "f2", label: "Allergies", type: "textarea", required: false },
          ],
        }),
      );
      expect(result.name).toBe("New Client Intake");
    });

    it("throws a Zod validation error when fields array is empty", async () => {
      vi.resetModules();
      setupMocks();
      const { createIntakeFormDefinition } =
        await import("@/app/dashboard/services/intake-form-actions");

      await expect(
        createIntakeFormDefinition({
          serviceId: 10,
          name: "Empty Form",
          fields: [],
        }),
      ).rejects.toThrow();
    });

    it("throws when user is not an admin", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authorized"));
      setupMocks();
      const { createIntakeFormDefinition } =
        await import("@/app/dashboard/services/intake-form-actions");

      await expect(
        createIntakeFormDefinition({
          serviceId: 10,
          name: "Blocked Form",
          fields: [{ id: "f1", label: "Name", type: "text", required: true }],
        }),
      ).rejects.toThrow("Not authorized");
    });

    it("tracks intake_form_created event after successful insert", async () => {
      vi.resetModules();
      setupMocks({
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: 2,
                name: "Event Test Form",
                fields: [{ id: "f1", label: "Name", type: "text", required: true }],
                version: 1,
                isActive: true,
              },
            ]),
          })),
        })),
      });
      const { createIntakeFormDefinition } =
        await import("@/app/dashboard/services/intake-form-actions");

      await createIntakeFormDefinition({
        serviceId: null,
        name: "Event Test Form",
        fields: [{ id: "f1", label: "Name", type: "text", required: true }],
      });

      expect(mockTrackEvent).toHaveBeenCalledWith("admin-1", "intake_form_created", {
        name: "Event Test Form",
      });
    });

    it("calls revalidatePath after successful insert", async () => {
      vi.resetModules();
      setupMocks({
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: 3,
                name: "Revalidate Form",
                fields: [{ id: "f1", label: "Name", type: "text", required: true }],
                version: 1,
                isActive: true,
              },
            ]),
          })),
        })),
      });
      const { createIntakeFormDefinition } =
        await import("@/app/dashboard/services/intake-form-actions");

      await createIntakeFormDefinition({
        serviceId: null,
        name: "Revalidate Form",
        fields: [{ id: "f1", label: "Name", type: "text", required: true }],
      });

      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
    });
  });

  /* ---- submitIntakeForm ---- */

  describe("submitIntakeForm", () => {
    it("stores responses as JSONB with correct bookingId and clientId", async () => {
      vi.resetModules();
      const mockValues = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 5,
              fields: [
                { id: "f1", label: "Full Name", type: "text", required: true },
                { id: "f2", label: "Notes", type: "textarea", required: false },
              ],
              version: 2,
              isActive: true,
            },
          ]),
        ),
        insert: vi.fn(() => ({ values: mockValues })),
      });
      const { submitIntakeForm } = await import("@/app/dashboard/services/intake-form-actions");

      await submitIntakeForm({
        bookingId: 99,
        formDefinitionId: 5,
        responses: { f1: "Jane Doe", f2: "No allergies" },
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: 99,
          formDefinitionId: 5,
          clientId: "user-1",
          responses: { f1: "Jane Doe", f2: "No allergies" },
          formVersion: 2,
        }),
      );
    });

    it("tracks intake_form_submitted event after insert", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 5,
              fields: [{ id: "f1", label: "Full Name", type: "text", required: true }],
              version: 1,
              isActive: true,
            },
          ]),
        ),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
      });
      const { submitIntakeForm } = await import("@/app/dashboard/services/intake-form-actions");

      await submitIntakeForm({
        bookingId: 7,
        formDefinitionId: 5,
        responses: { f1: "Bob Smith" },
      });

      expect(mockTrackEvent).toHaveBeenCalledWith("user-1", "intake_form_submitted", {
        formId: 5,
        bookingId: 7,
      });
    });
  });

  /* ---- submitIntakeForm — required field validation ---- */

  describe("submitIntakeForm — required field validation", () => {
    it("throws when a required field is missing from responses", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 5,
              fields: [
                { id: "f1", label: "Full Name", type: "text", required: true },
                { id: "f2", label: "Date of Birth", type: "date", required: true },
              ],
              version: 1,
            },
          ]),
        ),
      });
      const { submitIntakeForm } = await import("@/app/dashboard/services/intake-form-actions");

      // f2 is omitted — should fail required validation
      await expect(
        submitIntakeForm({
          bookingId: 1,
          formDefinitionId: 5,
          responses: { f1: "Jane Doe" },
        }),
      ).rejects.toThrow("Required fields missing: Date of Birth");
    });

    it("throws when a required field is an empty string", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 5,
              fields: [{ id: "f1", label: "Full Name", type: "text", required: true }],
              version: 1,
            },
          ]),
        ),
      });
      const { submitIntakeForm } = await import("@/app/dashboard/services/intake-form-actions");

      await expect(
        submitIntakeForm({
          bookingId: 1,
          formDefinitionId: 5,
          responses: { f1: "" },
        }),
      ).rejects.toThrow("Required fields missing: Full Name");
    });

    it("throws when a required multiselect field has an empty array", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 5,
              fields: [
                {
                  id: "f1",
                  label: "Preferred Days",
                  type: "multiselect",
                  required: true,
                  options: ["Mon", "Tue", "Wed"],
                },
              ],
              version: 1,
            },
          ]),
        ),
      });
      const { submitIntakeForm } = await import("@/app/dashboard/services/intake-form-actions");

      await expect(
        submitIntakeForm({
          bookingId: 1,
          formDefinitionId: 5,
          responses: { f1: [] },
        }),
      ).rejects.toThrow("Required fields missing: Preferred Days");
    });

    it("succeeds when all required fields are present and optional fields are omitted", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 5,
              fields: [
                { id: "f1", label: "Full Name", type: "text", required: true },
                { id: "f2", label: "Notes", type: "textarea", required: false },
              ],
              version: 1,
            },
          ]),
        ),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
      });
      const { submitIntakeForm } = await import("@/app/dashboard/services/intake-form-actions");

      // f2 intentionally omitted — should not throw
      await expect(
        submitIntakeForm({
          bookingId: 1,
          formDefinitionId: 5,
          responses: { f1: "Jane Doe" },
        }),
      ).resolves.toBeUndefined();
    });

    it("throws when the form definition is not found", async () => {
      vi.resetModules();
      setupMocks({
        // select returns empty — no form found
        select: vi.fn(() => makeChain([])),
      });
      const { submitIntakeForm } = await import("@/app/dashboard/services/intake-form-actions");

      await expect(
        submitIntakeForm({
          bookingId: 1,
          formDefinitionId: 999,
          responses: { f1: "Jane" },
        }),
      ).rejects.toThrow("Intake form not found");
    });
  });

  /* ---- getActiveIntakeFormsForBooking ---- */

  describe("getActiveIntakeFormsForBooking", () => {
    it("returns service-specific and global forms for the given serviceId", async () => {
      vi.resetModules();
      const serviceForm = {
        id: 1,
        serviceId: 10,
        name: "Lash Intake",
        fields: [],
        version: 1,
        isActive: true,
      };
      const globalForm = {
        id: 2,
        serviceId: null,
        name: "General Health",
        fields: [],
        version: 1,
        isActive: true,
      };
      let selectCall = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCall++;
          // call 1: service-specific forms
          if (selectCall === 1) return makeChain([serviceForm]);
          // call 2: global forms (serviceId IS NULL)
          return makeChain([globalForm]);
        }),
      });
      const { getActiveIntakeFormsForBooking } =
        await import("@/app/dashboard/services/intake-form-actions");

      const result = await getActiveIntakeFormsForBooking(10);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Lash Intake");
      expect(result[1].name).toBe("General Health");
    });

    it("returns only global forms when no service-specific forms exist", async () => {
      vi.resetModules();
      const globalForm = {
        id: 3,
        serviceId: null,
        name: "Global Intake",
        fields: [],
        version: 1,
        isActive: true,
      };
      let selectCall = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) return makeChain([]); // no service-specific
          return makeChain([globalForm]);
        }),
      });
      const { getActiveIntakeFormsForBooking } =
        await import("@/app/dashboard/services/intake-form-actions");

      const result = await getActiveIntakeFormsForBooking(99);

      expect(result).toHaveLength(1);
      expect(result[0].serviceId).toBeNull();
    });

    it("returns empty array and does not throw when DB errors", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => {
          throw new Error("DB connection error");
        }),
      });
      const { getActiveIntakeFormsForBooking } =
        await import("@/app/dashboard/services/intake-form-actions");

      const result = await getActiveIntakeFormsForBooking(10);

      expect(result).toEqual([]);
    });
  });
});
