// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions and spying on calls
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

// Returns an awaitable, chainable object that mimics Drizzle ORM's query builder.
// Every builder method (from, where, join, etc.) returns itself so any chain resolves to `rows`.
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

// vi.fn(): creates a mock function that records how it was called.
// mockGetUser simulates Supabase auth -- tests set its return value to control authentication state.
const mockGetUser = vi.fn();
// Captures PostHog analytics events so tests verify correct tracking without hitting the real API.
const mockTrackEvent = vi.fn();
const mockRevalidatePath = vi.fn();

// Registers vi.doMock() calls for all external dependencies (DB, auth, PostHog, etc.)
// so the imported server actions run against fakes instead of real services.
function setupMocks(db: Record<string, unknown> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    clientForms: {
      id: "id",
      name: "name",
      type: "type",
      description: "description",
      appliesTo: "appliesTo",
      required: "required",
      isActive: "isActive",
      fields: "fields",
      createdAt: "createdAt",
    },
    formSubmissions: {
      id: "id",
      formId: "formId",
      clientId: "clientId",
      data: "data",
      signatureUrl: "signatureUrl",
      formVersion: "formVersion",
      ipAddress: "ipAddress",
      submittedAt: "submittedAt",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("form-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getForms ---- */

  describe("getForms", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getForms } = await import("./form-actions");
      await expect(getForms()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no forms exist", async () => {
      vi.resetModules();
      setupMocks();
      const { getForms } = await import("./form-actions");
      const result = await getForms();
      expect(result).toEqual([]);
    });

    it("returns forms from db", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([{ id: 1, name: "Intake Form", type: "intake", isActive: true }]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getForms } = await import("./form-actions");
      const result = await getForms();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 1, name: "Intake Form" });
    });
  });

  /* ---- createForm ---- */

  describe("createForm", () => {
    const input = {
      name: "Intake Form",
      type: "intake" as const,
      description: "Standard intake form",
      appliesTo: ["All"],
      required: true,
      isActive: true,
    };

    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { createForm } = await import("./form-actions");
      await expect(createForm(input)).rejects.toThrow("Not authenticated");
    });

    it("inserts form with correct fields", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1, name: "Intake Form", type: "intake" }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createForm } = await import("./form-actions");
      const result = await createForm(input);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Intake Form",
          type: "intake",
          appliesTo: ["All"],
          required: true,
          isActive: true,
        }),
      );
      expect(result).toMatchObject({ id: 1, name: "Intake Form" });
    });

    it("stores null description when empty string is provided", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createForm } = await import("./form-actions");
      await createForm({ ...input, description: "" });
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
    });

    it("fires PostHog form_created event", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createForm } = await import("./form-actions");
      await createForm(input);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "form_created",
        expect.objectContaining({ name: "Intake Form", type: "intake" }),
      );
    });

    it("revalidates /dashboard/services", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createForm } = await import("./form-actions");
      await createForm(input);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
    });
  });

  /* ---- updateForm ---- */

  describe("updateForm", () => {
    const input = {
      name: "Updated Form",
      type: "waiver" as const,
      description: "Updated description",
      appliesTo: ["lash"],
      required: false,
      isActive: false,
    };

    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateForm } = await import("./form-actions");
      await expect(updateForm(1, input)).rejects.toThrow("Not authenticated");
    });

    it("calls db.update with updated fields", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 1, name: "Updated Form" }]),
        })),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateForm } = await import("./form-actions");
      await updateForm(1, input);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Updated Form", type: "waiver", isActive: false }),
      );
    });

    it("revalidates /dashboard/services", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([{ id: 1 }]),
            })),
          })),
        })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateForm } = await import("./form-actions");
      await updateForm(1, input);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
    });
  });

  /* ---- deleteForm ---- */

  describe("deleteForm", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { deleteForm } = await import("./form-actions");
      await expect(deleteForm(1)).rejects.toThrow("Not authenticated");
    });

    it("calls db.delete for the form", async () => {
      vi.resetModules();
      const mockDeleteWhere = vi.fn();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: mockDeleteWhere })),
      });
      const { deleteForm } = await import("./form-actions");
      await deleteForm(7);
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("fires PostHog form_deleted event", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteForm } = await import("./form-actions");
      await deleteForm(7);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "form_deleted",
        expect.objectContaining({ formId: 7 }),
      );
    });

    it("revalidates /dashboard/services", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteForm } = await import("./form-actions");
      await deleteForm(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
    });
  });

  /* ---- toggleFormActive ---- */

  describe("toggleFormActive", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { toggleFormActive } = await import("./form-actions");
      await expect(toggleFormActive(1, false)).rejects.toThrow("Not authenticated");
    });

    it("calls db.update with isActive value", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { toggleFormActive } = await import("./form-actions");
      await toggleFormActive(3, false);
      expect(mockUpdateSet).toHaveBeenCalledWith({ isActive: false });
    });

    it("revalidates /dashboard/services", async () => {
      vi.resetModules();
      setupMocks();
      const { toggleFormActive } = await import("./form-actions");
      await toggleFormActive(1, true);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
    });
  });

  /* ---- updateFormFields ---- */

  describe("updateFormFields", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateFormFields } = await import("./form-actions");
      await expect(updateFormFields(1, [])).rejects.toThrow("Not authenticated");
    });

    it("calls db.update with provided fields", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateFormFields } = await import("./form-actions");
      const fields = [{ id: "f1", label: "Name", type: "text", required: true }];
      await updateFormFields(1, fields);
      expect(mockUpdateSet).toHaveBeenCalledWith({ fields });
    });

    it("revalidates /dashboard/services", async () => {
      vi.resetModules();
      setupMocks();
      const { updateFormFields } = await import("./form-actions");
      await updateFormFields(1, []);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
    });
  });

  /* ---- getActiveForms ---- */

  describe("getActiveForms", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getActiveForms } = await import("./form-actions");
      await expect(getActiveForms()).rejects.toThrow("Not authenticated");
    });

    it("returns only active forms", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([{ id: 1, name: "Active Form", type: "intake", isActive: true }]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getActiveForms } = await import("./form-actions");
      const result = await getActiveForms();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 1, isActive: true });
    });
  });

  /* ---- getFormSubmissions ---- */

  describe("getFormSubmissions", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getFormSubmissions } = await import("./form-actions");
      await expect(getFormSubmissions("client-1")).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no submissions exist", async () => {
      vi.resetModules();
      setupMocks();
      const { getFormSubmissions } = await import("./form-actions");
      const result = await getFormSubmissions("client-1");
      expect(result).toEqual([]);
    });

    it("maps submission rows with formatted submittedAt date", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              formId: 2,
              formName: "Intake Form",
              formType: "intake",
              data: { name: "Jane" },
              signatureUrl: null,
              formVersion: null,
              submittedAt: new Date("2026-03-01T12:00:00Z"),
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getFormSubmissions } = await import("./form-actions");
      const result = await getFormSubmissions("client-1");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        formId: 2,
        formName: "Intake Form",
        formType: "intake",
      });
      // submittedAt should be a formatted string, not a Date
      expect(typeof result[0].submittedAt).toBe("string");
    });
  });

  /* ---- submitForm ---- */

  describe("submitForm", () => {
    const input = {
      clientId: "client-1",
      formId: 2,
      data: { name: "Jane Doe" },
      signatureUrl: "https://example.com/sig.png",
      formVersion: "1.0",
      ipAddress: "127.0.0.1",
    };

    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { submitForm } = await import("./form-actions");
      await expect(submitForm(input)).rejects.toThrow("Not authenticated");
    });

    it("inserts submission with correct fields", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitForm } = await import("./form-actions");
      await submitForm(input);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "client-1",
          formId: 2,
          signatureUrl: "https://example.com/sig.png",
          formVersion: "1.0",
          ipAddress: "127.0.0.1",
        }),
      );
    });

    it("stores null for optional fields when not provided", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitForm } = await import("./form-actions");
      await submitForm({ clientId: "client-1", formId: 2, data: {} });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          signatureUrl: null,
          formVersion: null,
          ipAddress: null,
        }),
      );
    });

    it("fires PostHog form_submitted event", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitForm } = await import("./form-actions");
      await submitForm(input);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "form_submitted",
        expect.objectContaining({ clientId: "client-1", formId: 2 }),
      );
    });

    it("revalidates /dashboard/clients", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { submitForm } = await import("./form-actions");
      await submitForm(input);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/clients");
    });
  });
});
