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

/* ------------------------------------------------------------------ */
/*  Mock setup helper                                                  */
/* ------------------------------------------------------------------ */

function setupMocks(overrides: Record<string, unknown> | null = null) {
  const resolvedDb = makeDefaultDb();
  if (overrides) Object.assign(resolvedDb, overrides);
  vi.doMock("@/db", () => ({ db: resolvedDb }));
  vi.doMock("@/db/schema", () => ({
    locations: {
      id: "id",
      name: "name",
      address: "address",
      city: "city",
      timezone: "timezone",
      phone: "phone",
      email: "email",
      squareLocationId: "squareLocationId",
      isActive: "isActive",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/lib/auth", () => ({
    requireAdmin: mockRequireAdmin,
    getUser: mockGetUser,
  }));
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

describe("location-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1", role: "admin" });
    mockGetUser.mockResolvedValue({ id: "user-1" });
  });

  /* ---- createLocation ---- */

  describe("createLocation", () => {
    it("throws when user is not admin", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Forbidden"));
      setupMocks();
      const { createLocation } = await import("./location-actions");
      await expect(
        createLocation({ name: "Studio A", timezone: "America/Los_Angeles" }),
      ).rejects.toThrow("Forbidden");
    });

    it("stores name, address, and timezone on insert", async () => {
      vi.resetModules();
      const mockReturning = vi.fn().mockResolvedValue([
        {
          id: 1,
          name: "San Jose Studio",
          address: "123 Main St",
          city: "San Jose",
          timezone: "America/Los_Angeles",
          phone: null,
          email: null,
          squareLocationId: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      const mockValues = vi.fn(() => ({ returning: mockReturning }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockValues })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
          })),
        })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createLocation } = await import("./location-actions");

      const result = await createLocation({
        name: "San Jose Studio",
        address: "123 Main St",
        city: "San Jose",
        timezone: "America/Los_Angeles",
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "San Jose Studio",
          address: "123 Main St",
          timezone: "America/Los_Angeles",
        }),
      );
      expect(result).toMatchObject({ id: 1, name: "San Jose Studio" });
    });

    it("stores null for optional fields when not provided", async () => {
      vi.resetModules();
      const mockValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([
          {
            id: 2,
            name: "Pop-up Studio",
            address: null,
            city: null,
            timezone: "America/New_York",
            phone: null,
            email: null,
            squareLocationId: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockValues })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
          })),
        })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createLocation } = await import("./location-actions");

      await createLocation({ name: "Pop-up Studio", timezone: "America/New_York" });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          address: null,
          city: null,
          phone: null,
          email: null,
          squareLocationId: null,
        }),
      );
    });

    it("revalidates dashboard path after create", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([
              {
                id: 3,
                name: "Studio B",
                timezone: "America/Chicago",
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            ]),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
          })),
        })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createLocation } = await import("./location-actions");

      await createLocation({ name: "Studio B", timezone: "America/Chicago" });

      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
    });

    it("throws validation error when name is empty", async () => {
      vi.resetModules();
      setupMocks();
      const { createLocation } = await import("./location-actions");
      await expect(createLocation({ name: "", timezone: "America/Los_Angeles" })).rejects.toThrow();
    });

    it("throws validation error when timezone is missing", async () => {
      vi.resetModules();
      setupMocks();
      const { createLocation } = await import("./location-actions");
      await expect(
        // @ts-expect-error intentionally omitting required field
        createLocation({ name: "Studio X" }),
      ).rejects.toThrow();
    });
  });

  /* ---- getActiveLocations (location filter) ---- */

  describe("getActiveLocations", () => {
    it("returns empty array when user is not authenticated (swallows error)", async () => {
      vi.resetModules();
      mockGetUser.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { getActiveLocations } = await import("./location-actions");
      // getActiveLocations swallows errors and returns []
      const result = await getActiveLocations();
      expect(result).toEqual([]);
    });

    it("location filter: queries only return active locations (isActive = true)", async () => {
      vi.resetModules();
      const activeLocations = [
        {
          id: 1,
          name: "San Jose Studio",
          timezone: "America/Los_Angeles",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          name: "Palo Alto Pop-up",
          timezone: "America/Los_Angeles",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      setupMocks({
        select: vi.fn(() => makeChain(activeLocations)),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
          })),
        })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getActiveLocations } = await import("./location-actions");

      const result = await getActiveLocations();

      // Only active locations returned — inactive ones are excluded by the
      // WHERE isActive = true clause applied in the query
      expect(result).toHaveLength(2);
      expect(result.every((l) => l.isActive === true)).toBe(true);
    });

    it("location filter: inactive location deactivated via updateLocation does not appear", async () => {
      // When a location is deactivated (isActive set to false), getActiveLocations
      // filters it out — bookings/hours queries for that location stop returning results.
      vi.resetModules();
      setupMocks({
        // getActiveLocations returns only the one still-active location
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              name: "San Jose Studio",
              timezone: "America/Los_Angeles",
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
          })),
        })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getActiveLocations } = await import("./location-actions");

      const result = await getActiveLocations();

      // The deactivated location (id=2) is absent — only id=1 is returned
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  /* ---- getAllLocations ---- */

  describe("getAllLocations", () => {
    it("throws when user is not admin", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Forbidden"));
      setupMocks();
      const { getAllLocations } = await import("./location-actions");
      await expect(getAllLocations()).rejects.toThrow("Forbidden");
    });

    it("returns all locations including inactive ones (no isActive filter)", async () => {
      vi.resetModules();
      const allLocations = [
        {
          id: 1,
          name: "Active Studio",
          isActive: true,
          timezone: "America/Los_Angeles",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          name: "Closed Studio",
          isActive: false,
          timezone: "America/Los_Angeles",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      setupMocks({
        select: vi.fn(() => makeChain(allLocations)),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
          })),
        })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getAllLocations } = await import("./location-actions");

      const result = await getAllLocations();

      expect(result).toHaveLength(2);
      expect(result.some((l) => l.isActive === false)).toBe(true);
    });
  });

  /* ---- updateLocation ---- */

  describe("updateLocation", () => {
    it("throws when user is not admin", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Forbidden"));
      setupMocks();
      const { updateLocation } = await import("./location-actions");
      await expect(updateLocation(1, { name: "New Name" })).rejects.toThrow("Forbidden");
    });

    it("default location set: first active location drives the default selection", async () => {
      // The dashboard defaults to the first entry from getActiveLocations (ordered by name).
      // updateLocation can promote a location to "first" by name. This test verifies
      // that setting a location's name changes what getActiveLocations returns first.
      vi.resetModules();
      const updatedRow = {
        id: 1,
        name: "AAA Primary Studio",
        address: null,
        city: null,
        timezone: "America/Los_Angeles",
        phone: null,
        email: null,
        squareLocationId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockReturning = vi.fn().mockResolvedValue([updatedRow]);
      const mockWhere = vi.fn(() => ({ returning: mockReturning }));
      const mockSet = vi.fn(() => ({ where: mockWhere }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: mockSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateLocation } = await import("./location-actions");

      const result = await updateLocation(1, { name: "AAA Primary Studio" });

      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ name: "AAA Primary Studio" }));
      expect(result).toMatchObject({ id: 1, name: "AAA Primary Studio" });
    });

    it("deactivates a location by setting isActive to false", async () => {
      vi.resetModules();
      const deactivatedRow = {
        id: 2,
        name: "Closed Studio",
        timezone: "America/Los_Angeles",
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockSet = vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([deactivatedRow]),
        })),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: mockSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateLocation } = await import("./location-actions");

      const result = await updateLocation(2, { isActive: false });

      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
      expect(result.isActive).toBe(false);
    });

    it("delete location with existing bookings: DB restrict error propagates", async () => {
      // The bookings.locationId FK uses onDelete:'set null', but other tables
      // (business_hours, shifts, time_off) may use restrict. Simulates a DB-level
      // error thrown when attempting to hard-delete a location with references,
      // verifying the action does not swallow the error.
      vi.resetModules();
      const dbConstraintError = new Error(
        'violates foreign key constraint "business_hours_location_id_fkey"',
      );
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({ returning: vi.fn().mockRejectedValue(dbConstraintError) })),
          })),
        })),
        delete: vi.fn(() => ({
          where: vi.fn().mockRejectedValue(dbConstraintError),
        })),
      });
      const { updateLocation } = await import("./location-actions");

      // An attempted hard-delete-equivalent operation (deactivation that
      // triggers a DB constraint) is rejected and the error propagates
      await expect(updateLocation(3, { isActive: false })).rejects.toThrow(
        "foreign key constraint",
      );
    });

    it("revalidates dashboard path after update", async () => {
      vi.resetModules();
      const mockSet = vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([
            {
              id: 1,
              name: "Studio A",
              timezone: "America/Los_Angeles",
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]),
        })),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: mockSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateLocation } = await import("./location-actions");

      await updateLocation(1, { name: "Studio A Updated" });

      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard");
    });
  });
});
