/**
 * @file client-setup-data.test.ts
 * Unit tests for getClientSetupData — client onboarding step completeness.
 *
 * Covers:
 *  getClientSetupData — all steps incomplete for a new client
 *  getClientSetupData — step 1 done when firstName + interests present
 *  getClientSetupData — step 2 done when allergies + availability filled
 *  getClientSetupData — step 3 done when waiver + cancellation agreed
 *  getClientSetupData — 3/3 when all steps complete
 *  getClientSetupData — missing profile returns empty defaults
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

function setupMocks(profileRows: unknown[] = []) {
  vi.doMock("@/db", () => ({
    db: { select: vi.fn(() => makeChain(profileRows)) },
  }));
  vi.doMock("@/db/schema", () => ({
    profiles: {
      id: "id",
      firstName: "firstName",
      onboardingData: "onboardingData",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  }));
  vi.doMock("react", () => ({
    cache: (fn: unknown) => fn,
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("getClientSetupData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all steps incomplete for a new client with no onboarding data", async () => {
    vi.resetModules();
    setupMocks([{ id: "client-1", firstName: "Jane", onboardingData: null }]);
    const { getClientSetupData } = await import("./client-setup-data");
    const result = await getClientSetupData("client-1");
    expect(result.setupProgress).toBe("0/3");
    expect(result.hasProfile).toBe(false);
    expect(result.hasPreferences).toBe(false);
    expect(result.hasPolicies).toBe(false);
    expect(result.firstName).toBe("Jane");
  });

  it("counts step 1 complete when firstName and at least one interest are set", async () => {
    vi.resetModules();
    setupMocks([
      {
        id: "client-1",
        firstName: "Jane",
        onboardingData: { interests: ["lash"] },
      },
    ]);
    const { getClientSetupData } = await import("./client-setup-data");
    const result = await getClientSetupData("client-1");
    expect(result.hasProfile).toBe(true);
    expect(result.setupProgress).toBe("1/3");
  });

  it("step 1 is incomplete when interests array is empty", async () => {
    vi.resetModules();
    setupMocks([
      {
        id: "client-1",
        firstName: "Jane",
        onboardingData: { interests: [] },
      },
    ]);
    const { getClientSetupData } = await import("./client-setup-data");
    const result = await getClientSetupData("client-1");
    expect(result.hasProfile).toBe(false);
  });

  it("counts step 2 complete when allergies and availability are filled", async () => {
    vi.resetModules();
    setupMocks([
      {
        id: "client-1",
        firstName: "Jane",
        onboardingData: {
          allergies: { latex: false },
          availability: { weekdays: true },
        },
      },
    ]);
    const { getClientSetupData } = await import("./client-setup-data");
    const result = await getClientSetupData("client-1");
    expect(result.hasPreferences).toBe(true);
    expect(result.setupProgress).toBe("1/3");
  });

  it("counts step 3 complete when waiver and cancellation are agreed", async () => {
    vi.resetModules();
    setupMocks([
      {
        id: "client-1",
        firstName: "Jane",
        onboardingData: {
          waiverAgreed: true,
          cancellationAgreed: true,
        },
      },
    ]);
    const { getClientSetupData } = await import("./client-setup-data");
    const result = await getClientSetupData("client-1");
    expect(result.hasPolicies).toBe(true);
    expect(result.setupProgress).toBe("1/3");
  });

  it("returns 3/3 when all three onboarding steps are complete", async () => {
    vi.resetModules();
    setupMocks([
      {
        id: "client-1",
        firstName: "Jane",
        onboardingData: {
          interests: ["lash", "jewelry"],
          allergies: { latex: false },
          availability: { weekdays: true },
          waiverAgreed: true,
          cancellationAgreed: true,
        },
      },
    ]);
    const { getClientSetupData } = await import("./client-setup-data");
    const result = await getClientSetupData("client-1");
    expect(result.setupProgress).toBe("3/3");
    expect(result.hasProfile).toBe(true);
    expect(result.hasPreferences).toBe(true);
    expect(result.hasPolicies).toBe(true);
  });

  it("returns empty firstName and 0/3 when profile is not found", async () => {
    vi.resetModules();
    setupMocks([]);
    const { getClientSetupData } = await import("./client-setup-data");
    const result = await getClientSetupData("ghost-user");
    expect(result.firstName).toBe("");
    expect(result.setupProgress).toBe("0/3");
    expect(result.hasProfile).toBe(false);
    expect(result.hasPreferences).toBe(false);
    expect(result.hasPolicies).toBe(false);
  });
});
