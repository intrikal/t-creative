/**
 * @file admin-setup-data.test.ts
 * Unit tests for getAdminSetupData — admin onboarding step completeness.
 *
 * Covers:
 *  getAdminSetupData — all steps incomplete for a new admin
 *  getAdminSetupData — step 1 done when studioName + location + socials set
 *  getAdminSetupData — step 2 done when cancellation or no-show policy set
 *  getAdminSetupData — step 3 done when at least one service has a deposit
 *  getAdminSetupData — 3/3 when all steps complete
 *  getAdminSetupData — missing profile returns empty defaults
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    limit: () => chain,
    then(onFulfilled: (v: unknown) => unknown) {
      return resolved.then(onFulfilled);
    },
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Mock setup                                                         */
/* ------------------------------------------------------------------ */

function setupMocks(profileRows: unknown[] = [], serviceRows: unknown[] = []) {
  let callCount = 0;
  vi.doMock("@/db", () => ({
    db: {
      select: vi.fn(() => {
        callCount++;
        return callCount === 1 ? makeChain(profileRows) : makeChain(serviceRows);
      }),
    },
  }));
  vi.doMock("@/db/schema", () => ({
    profiles: {
      id: "id",
      firstName: "firstName",
      role: "role",
      onboardingData: "onboardingData",
    },
  }));
  vi.doMock("@/db/schema/services", () => ({
    services: { id: "id", depositInCents: "depositInCents" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    isNotNull: vi.fn((...args: unknown[]) => ({ type: "isNotNull", args })),
  }));
  vi.doMock("react", () => ({
    cache: (fn: unknown) => fn,
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("getAdminSetupData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all steps incomplete for a new admin with no onboarding data", async () => {
    vi.resetModules();
    setupMocks([{ id: "admin-1", firstName: "Alex", onboardingData: null }], []);
    const { getAdminSetupData } = await import("./admin-setup-data");
    const result = await getAdminSetupData("admin-1");
    expect(result.setupProgress).toBe("0/3");
    expect(result.hasPolicies).toBe(false);
    expect(result.hasDeposits).toBe(false);
    expect(result.socialCount).toBe(0);
    expect(result.studioName).toBeNull();
    expect(result.locationArea).toBeNull();
    expect(result.firstName).toBe("Alex");
  });

  it("counts step 1 done when studioName, locationArea, and at least one social are set", async () => {
    vi.resetModules();
    setupMocks(
      [
        {
          id: "admin-1",
          firstName: "Alex",
          onboardingData: {
            studioName: "T Creative Studio",
            location: { area: "Brooklyn, NY" },
            socials: { instagram: "@tcreative" },
          },
        },
      ],
      [],
    );
    const { getAdminSetupData } = await import("./admin-setup-data");
    const result = await getAdminSetupData("admin-1");
    expect(result.studioName).toBe("T Creative Studio");
    expect(result.locationArea).toBe("Brooklyn, NY");
    expect(result.socialCount).toBe(1);
    expect(result.setupProgress).toBe("1/3");
  });

  it("step 1 is incomplete when socials are empty", async () => {
    vi.resetModules();
    setupMocks(
      [
        {
          id: "admin-1",
          firstName: "Alex",
          onboardingData: {
            studioName: "Studio",
            location: { area: "NYC" },
            socials: {},
          },
        },
      ],
      [],
    );
    const { getAdminSetupData } = await import("./admin-setup-data");
    const result = await getAdminSetupData("admin-1");
    expect(result.socialCount).toBe(0);
    expect(result.setupProgress).toBe("0/3");
  });

  it("counts step 2 done when cancellation fee policy is set", async () => {
    vi.resetModules();
    setupMocks(
      [
        {
          id: "admin-1",
          firstName: "Alex",
          onboardingData: {
            studioName: "Studio",
            location: { area: "NYC" },
            socials: { ig: "x" },
            policies: { cancellationFeeInCents: 5000 },
          },
        },
      ],
      [],
    );
    const { getAdminSetupData } = await import("./admin-setup-data");
    const result = await getAdminSetupData("admin-1");
    expect(result.hasPolicies).toBe(true);
    expect(result.setupProgress).toBe("2/3");
  });

  it("counts step 2 done when no-show fee policy is set", async () => {
    vi.resetModules();
    setupMocks(
      [
        {
          id: "admin-1",
          firstName: "Alex",
          onboardingData: {
            studioName: "Studio",
            location: { area: "NYC" },
            socials: { ig: "x" },
            policies: { noShowFeeInCents: 3000 },
          },
        },
      ],
      [],
    );
    const { getAdminSetupData } = await import("./admin-setup-data");
    const result = await getAdminSetupData("admin-1");
    expect(result.hasPolicies).toBe(true);
  });

  it("counts step 3 done when at least one service has a deposit configured", async () => {
    vi.resetModules();
    setupMocks(
      [{ id: "admin-1", firstName: "Alex", onboardingData: {} }],
      [{ id: 1 }],
    );
    const { getAdminSetupData } = await import("./admin-setup-data");
    const result = await getAdminSetupData("admin-1");
    expect(result.hasDeposits).toBe(true);
    expect(result.setupProgress).toBe("1/3");
  });

  it("returns 3/3 when all three steps are complete", async () => {
    vi.resetModules();
    setupMocks(
      [
        {
          id: "admin-1",
          firstName: "Alex",
          onboardingData: {
            studioName: "T Creative",
            location: { area: "Brooklyn" },
            socials: { instagram: "@tc", tiktok: "@tc2" },
            policies: { cancellationFeeInCents: 5000 },
          },
        },
      ],
      [{ id: 1 }],
    );
    const { getAdminSetupData } = await import("./admin-setup-data");
    const result = await getAdminSetupData("admin-1");
    expect(result.setupProgress).toBe("3/3");
    expect(result.socialCount).toBe(2);
    expect(result.hasPolicies).toBe(true);
    expect(result.hasDeposits).toBe(true);
  });

  it("returns empty firstName and 0/3 when profile is not found", async () => {
    vi.resetModules();
    setupMocks([], []);
    const { getAdminSetupData } = await import("./admin-setup-data");
    const result = await getAdminSetupData("ghost-user");
    expect(result.firstName).toBe("");
    expect(result.setupProgress).toBe("0/3");
  });
});
