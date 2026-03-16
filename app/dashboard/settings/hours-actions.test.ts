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
const mockRevalidatePath = vi.fn();

function setupMocks(db: Record<string, unknown> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        returning: vi.fn().mockResolvedValue([]),
      })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
    transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => {
      const tx = {
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
      };
      await fn(tx);
    }),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    businessHours: {
      id: "id",
      staffId: "staffId",
      dayOfWeek: "dayOfWeek",
      isOpen: "isOpen",
      opensAt: "opensAt",
      closesAt: "closesAt",
    },
    timeOff: {
      id: "id",
      staffId: "staffId",
      type: "type",
      startDate: "startDate",
      endDate: "endDate",
      label: "label",
      notes: "notes",
      createdAt: "createdAt",
    },
    settings: {
      key: "key",
      label: "label",
      description: "description",
      value: "value",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("hours-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getBusinessHours ---- */

  describe("getBusinessHours", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getBusinessHours } = await import("./hours-actions");
      await expect(getBusinessHours()).rejects.toThrow("Not authenticated");
    });

    it("returns existing rows sorted by dayOfWeek", async () => {
      vi.resetModules();
      const rows = [
        { id: 2, dayOfWeek: 2, isOpen: true, opensAt: "09:00", closesAt: "18:00", staffId: null },
        { id: 1, dayOfWeek: 1, isOpen: true, opensAt: "09:00", closesAt: "18:00", staffId: null },
      ];
      setupMocks({
        select: vi.fn(() => makeChain(rows)),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { getBusinessHours } = await import("./hours-actions");
      const result = await getBusinessHours();
      expect(result).toHaveLength(2);
      expect(result[0].dayOfWeek).toBe(1);
      expect(result[1].dayOfWeek).toBe(2);
    });

    it("seeds default hours and returns them when no rows exist", async () => {
      vi.resetModules();
      const inserted = [
        { id: 1, dayOfWeek: 1, isOpen: true, opensAt: "09:00", closesAt: "18:00", staffId: null },
        { id: 7, dayOfWeek: 7, isOpen: false, opensAt: null, closesAt: null, staffId: null },
      ];
      const mockInsertValues = vi.fn(() => ({ returning: vi.fn().mockResolvedValue(inserted) }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { getBusinessHours } = await import("./hours-actions");
      const result = await getBusinessHours();
      expect(mockInsertValues).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  /* ---- saveBusinessHours ---- */

  describe("saveBusinessHours", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { saveBusinessHours } = await import("./hours-actions");
      await expect(saveBusinessHours([])).rejects.toThrow("Not authenticated");
    });

    it("runs a transaction to delete and re-insert", async () => {
      vi.resetModules();
      const mockTxDelete = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
      const mockTxInsert = vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) }));
      const mockTransaction = vi.fn(async (fn: any) => {
        await fn({ delete: mockTxDelete, insert: mockTxInsert });
      });
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: mockTransaction,
      });
      const { saveBusinessHours } = await import("./hours-actions");
      const days = [{ dayOfWeek: 1, isOpen: true, opensAt: "09:00", closesAt: "18:00" }];
      await saveBusinessHours(days);
      expect(mockTransaction).toHaveBeenCalled();
      expect(mockTxDelete).toHaveBeenCalled();
      expect(mockTxInsert).toHaveBeenCalled();
    });

    it("revalidates /dashboard/settings", async () => {
      vi.resetModules();
      setupMocks();
      const { saveBusinessHours } = await import("./hours-actions");
      await saveBusinessHours([]);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });
  });

  /* ---- getTimeOff ---- */

  describe("getTimeOff", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getTimeOff } = await import("./hours-actions");
      await expect(getTimeOff()).rejects.toThrow("Not authenticated");
    });

    it("returns time off rows", async () => {
      vi.resetModules();
      const rows = [
        {
          id: 1,
          type: "day_off",
          startDate: "2026-07-04",
          endDate: "2026-07-04",
          label: "Holiday",
          staffId: null,
        },
      ];
      setupMocks({
        select: vi.fn(() => makeChain(rows)),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { getTimeOff } = await import("./hours-actions");
      const result = await getTimeOff();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 1, type: "day_off" });
    });
  });

  /* ---- addTimeOff ---- */

  describe("addTimeOff", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { addTimeOff } = await import("./hours-actions");
      await expect(
        addTimeOff({ type: "day_off", startDate: "2026-07-04", endDate: "2026-07-04" }),
      ).rejects.toThrow("Not authenticated");
    });

    it("inserts time off row and returns it", async () => {
      vi.resetModules();
      const newRow = {
        id: 5,
        type: "vacation",
        startDate: "2026-08-01",
        endDate: "2026-08-07",
        label: "Trip",
        staffId: null,
      };
      const mockInsertValues = vi.fn(() => ({ returning: vi.fn().mockResolvedValue([newRow]) }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { addTimeOff } = await import("./hours-actions");
      const result = await addTimeOff({
        type: "vacation",
        startDate: "2026-08-01",
        endDate: "2026-08-07",
        label: "Trip",
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ type: "vacation", startDate: "2026-08-01", staffId: null }),
      );
      expect(result).toEqual(newRow);
    });

    it("uses null label when not provided", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi
          .fn()
          .mockResolvedValue([
            {
              id: 1,
              type: "day_off",
              startDate: "2026-07-04",
              endDate: "2026-07-04",
              label: null,
              staffId: null,
            },
          ]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { addTimeOff } = await import("./hours-actions");
      await addTimeOff({ type: "day_off", startDate: "2026-07-04", endDate: "2026-07-04" });
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ label: null }));
    });

    it("revalidates /dashboard/settings", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi
          .fn()
          .mockResolvedValue([
            {
              id: 1,
              type: "day_off",
              startDate: "2026-07-04",
              endDate: "2026-07-04",
              label: null,
              staffId: null,
            },
          ]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { addTimeOff } = await import("./hours-actions");
      await addTimeOff({ type: "day_off", startDate: "2026-07-04", endDate: "2026-07-04" });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });
  });

  /* ---- deleteTimeOff ---- */

  describe("deleteTimeOff", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { deleteTimeOff } = await import("./hours-actions");
      await expect(deleteTimeOff(1)).rejects.toThrow("Not authenticated");
    });

    it("calls db.delete for the time off entry", async () => {
      vi.resetModules();
      const mockDeleteWhere = vi.fn();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: mockDeleteWhere })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { deleteTimeOff } = await import("./hours-actions");
      await deleteTimeOff(7);
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("revalidates /dashboard/settings", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteTimeOff } = await import("./hours-actions");
      await deleteTimeOff(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });
  });

  /* ---- getLunchBreak ---- */

  describe("getLunchBreak", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getLunchBreak } = await import("./hours-actions");
      await expect(getLunchBreak()).rejects.toThrow("Not authenticated");
    });

    it("returns null when no lunch break is saved", async () => {
      vi.resetModules();
      setupMocks();
      const { getLunchBreak } = await import("./hours-actions");
      const result = await getLunchBreak();
      expect(result).toBeNull();
    });

    it("returns stored lunch break value", async () => {
      vi.resetModules();
      const stored = { enabled: true, start: "12:00", end: "13:00" };
      setupMocks({
        select: vi.fn(() => makeChain([{ key: "lunch_break", value: stored }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { getLunchBreak } = await import("./hours-actions");
      const result = await getLunchBreak();
      expect(result).toEqual(stored);
    });
  });

  /* ---- saveLunchBreak ---- */

  describe("saveLunchBreak", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { saveLunchBreak } = await import("./hours-actions");
      await expect(saveLunchBreak({ enabled: true, start: "12:00", end: "13:00" })).rejects.toThrow(
        "Not authenticated",
      );
    });

    it("upserts the lunch break setting", async () => {
      vi.resetModules();
      const mockOnConflict = vi.fn().mockResolvedValue(undefined);
      const mockInsertValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflict }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { saveLunchBreak } = await import("./hours-actions");
      const data = { enabled: true, start: "12:00", end: "13:00" };
      await saveLunchBreak(data);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ key: "lunch_break", label: "Lunch Break" }),
      );
      expect(mockOnConflict).toHaveBeenCalled();
    });

    it("revalidates /dashboard/settings", async () => {
      vi.resetModules();
      setupMocks();
      const { saveLunchBreak } = await import("./hours-actions");
      await saveLunchBreak({ enabled: false, start: "12:00", end: "13:00" });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });
  });
});
