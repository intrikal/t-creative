/**
 * @file assistant-setup-data.test.ts
 * Unit tests for getAssistantSetupData — assistant onboarding step completeness.
 *
 * Covers:
 *  getAssistantSetupData — all steps incomplete for a new assistant
 *  getAssistantSetupData — step 1 done when assistantProfile has specialties
 *  getAssistantSetupData — step 2 done when availability dates are set
 *  getAssistantSetupData — step 3 done when emergency contact + all policies set
 *  getAssistantSetupData — 3/3 when all steps complete
 *  getAssistantSetupData — missing profile returns empty defaults
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

function setupMocks(profileRows: unknown[] = [], assistantProfileRows: unknown[] = []) {
  let callCount = 0;
  vi.doMock("@/db", () => ({
    db: {
      select: vi.fn(() => {
        callCount++;
        return callCount === 1 ? makeChain(profileRows) : makeChain(assistantProfileRows);
      }),
    },
  }));
  vi.doMock("@/db/schema", () => ({
    profiles: {
      id: "id",
      firstName: "firstName",
      onboardingData: "onboardingData",
    },
    assistantProfiles: {
      profileId: "profileId",
      specialties: "specialties",
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

describe("getAssistantSetupData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all steps incomplete for a new assistant with no onboarding data", async () => {
    vi.resetModules();
    setupMocks([{ id: "asst-1", firstName: "Morgan", onboardingData: null }], []);
    const { getAssistantSetupData } = await import("./assistant-setup-data");
    const result = await getAssistantSetupData("asst-1");
    expect(result.setupProgress).toBe("0/3");
    expect(result.hasProfile).toBe(false);
    expect(result.hasAvailability).toBe(false);
    expect(result.hasEmergencyAndPolicies).toBe(false);
    expect(result.firstName).toBe("Morgan");
  });

  it("counts step 1 complete when assistantProfile row has specialties", async () => {
    vi.resetModules();
    setupMocks(
      [{ id: "asst-1", firstName: "Morgan", onboardingData: {} }],
      [{ profileId: "asst-1", specialties: ["lash", "jewelry"] }],
    );
    const { getAssistantSetupData } = await import("./assistant-setup-data");
    const result = await getAssistantSetupData("asst-1");
    expect(result.hasProfile).toBe(true);
    expect(result.setupProgress).toBe("1/3");
  });

  it("step 1 is incomplete when assistantProfile row has no specialties", async () => {
    vi.resetModules();
    setupMocks(
      [{ id: "asst-1", firstName: "Morgan", onboardingData: {} }],
      [{ profileId: "asst-1", specialties: null }],
    );
    const { getAssistantSetupData } = await import("./assistant-setup-data");
    const result = await getAssistantSetupData("asst-1");
    expect(result.hasProfile).toBe(false);
  });

  it("counts step 2 complete when availability has at least one date", async () => {
    vi.resetModules();
    setupMocks(
      [
        {
          id: "asst-1",
          firstName: "Morgan",
          onboardingData: {
            availability: { dates: ["2026-05-01", "2026-05-02"] },
          },
        },
      ],
      [],
    );
    const { getAssistantSetupData } = await import("./assistant-setup-data");
    const result = await getAssistantSetupData("asst-1");
    expect(result.hasAvailability).toBe(true);
    expect(result.setupProgress).toBe("1/3");
  });

  it("step 2 is incomplete when availability dates array is empty", async () => {
    vi.resetModules();
    setupMocks(
      [
        {
          id: "asst-1",
          firstName: "Morgan",
          onboardingData: { availability: { dates: [] } },
        },
      ],
      [],
    );
    const { getAssistantSetupData } = await import("./assistant-setup-data");
    const result = await getAssistantSetupData("asst-1");
    expect(result.hasAvailability).toBe(false);
  });

  it("counts step 3 complete when emergency contact and all four policies are set", async () => {
    vi.resetModules();
    setupMocks(
      [
        {
          id: "asst-1",
          firstName: "Morgan",
          onboardingData: {
            emergencyContactName: "Sam",
            emergencyContactPhone: "555-1234",
            policies: {
              clientPhotos: true,
              confidentiality: true,
              conduct: true,
              compensation: true,
            },
          },
        },
      ],
      [],
    );
    const { getAssistantSetupData } = await import("./assistant-setup-data");
    const result = await getAssistantSetupData("asst-1");
    expect(result.hasEmergencyAndPolicies).toBe(true);
    expect(result.setupProgress).toBe("1/3");
  });

  it("step 3 is incomplete when emergency contact is missing", async () => {
    vi.resetModules();
    setupMocks(
      [
        {
          id: "asst-1",
          firstName: "Morgan",
          onboardingData: {
            policies: {
              clientPhotos: true,
              confidentiality: true,
              conduct: true,
              compensation: true,
            },
          },
        },
      ],
      [],
    );
    const { getAssistantSetupData } = await import("./assistant-setup-data");
    const result = await getAssistantSetupData("asst-1");
    expect(result.hasEmergencyAndPolicies).toBe(false);
  });

  it("returns 3/3 when all three steps are complete", async () => {
    vi.resetModules();
    setupMocks(
      [
        {
          id: "asst-1",
          firstName: "Morgan",
          onboardingData: {
            availability: { dates: ["2026-05-01"] },
            emergencyContactName: "Sam",
            emergencyContactPhone: "555-1234",
            policies: {
              clientPhotos: true,
              confidentiality: true,
              conduct: true,
              compensation: true,
            },
          },
        },
      ],
      [{ profileId: "asst-1", specialties: ["lash"] }],
    );
    const { getAssistantSetupData } = await import("./assistant-setup-data");
    const result = await getAssistantSetupData("asst-1");
    expect(result.setupProgress).toBe("3/3");
    expect(result.hasProfile).toBe(true);
    expect(result.hasAvailability).toBe(true);
    expect(result.hasEmergencyAndPolicies).toBe(true);
  });

  it("returns empty firstName and 0/3 when profile is not found", async () => {
    vi.resetModules();
    setupMocks([], []);
    const { getAssistantSetupData } = await import("./assistant-setup-data");
    const result = await getAssistantSetupData("unknown");
    expect(result.firstName).toBe("");
    expect(result.setupProgress).toBe("0/3");
  });
});
