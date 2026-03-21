// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
import { describe, it, expect } from "vitest";
// ZONES: config object mapping zone IDs to their display metadata (label, heading, camera angles, CTA)
// ZONE_ORDER: ordered array of zone IDs controlling the sequence zones appear in the UI
// HERO_CAMERA / CENTER_CAMERA: preset 3D camera positions/lookAt targets for the Three.js scene
import { ZONES, ZONE_ORDER, HERO_CAMERA, CENTER_CAMERA } from "@/lib/zones";

// Tests for the ZONES configuration — verifies the data shape each zone must have
// so the 3D homepage scene and zone panels render correctly.
describe("ZONES", () => {
  // The four business verticals T Creative offers — these are the only valid zone IDs
  const expectedKeys = ["lash", "jewelry", "crochet", "consulting"];

  // Ensure no zone was accidentally added or removed
  it("has exactly 4 keys: lash, jewelry, crochet, consulting", () => {
    const keys = Object.keys(ZONES);
    expect(keys).toHaveLength(4);
    expect(keys.sort()).toEqual(expectedKeys.sort());
  });

  // Parametrized test — runs once per zone to confirm the full display contract
  it.each(expectedKeys)("zone '%s' has all required fields", (zoneId) => {
    const zone = ZONES[zoneId as keyof typeof ZONES];
    expect(zone).toHaveProperty("label");
    expect(zone).toHaveProperty("heading");
    expect(zone).toHaveProperty("subtitle");
    expect(zone).toHaveProperty("description");
    expect(zone).toHaveProperty("color");
    expect(zone).toHaveProperty("cameraPosition");
    expect(zone).toHaveProperty("cameraLookAt");
    expect(zone).toHaveProperty("cta");

    // Verify types for non-trivial fields
    expect(typeof zone.label).toBe("string");
    expect(typeof zone.heading).toBe("string");
    expect(typeof zone.description).toBe("string");
    expect(typeof zone.color).toBe("string");
    // Camera tuples must be [x, y, z] — exactly 3 elements for Three.js Vector3
    expect(zone.cameraPosition).toHaveLength(3);
    expect(zone.cameraLookAt).toHaveLength(3);
    expect(zone.cta).toHaveProperty("label");
    expect(zone.cta).toHaveProperty("href");
  });
});

// Tests for ZONE_ORDER — the carousel/navigation sequence must include every zone
describe("ZONE_ORDER", () => {
  // Every zone must appear in the ordering array so none are hidden from the UI
  it("contains all 4 zone IDs", () => {
    expect(ZONE_ORDER).toContain("lash");
    expect(ZONE_ORDER).toContain("jewelry");
    expect(ZONE_ORDER).toContain("crochet");
    expect(ZONE_ORDER).toContain("consulting");
  });

  // Guard against adding a zone to ZONES but forgetting to add it to the order array
  it("length matches ZONES keys length", () => {
    expect(ZONE_ORDER).toHaveLength(Object.keys(ZONES).length);
  });
});

// Tests for camera presets used in the 3D scene — ensures valid [x, y, z] tuples
describe("Camera presets", () => {
  // HERO_CAMERA is the initial camera angle shown on page load
  it("HERO_CAMERA has position and lookAt tuples of length 3", () => {
    expect(HERO_CAMERA.position).toHaveLength(3);
    expect(HERO_CAMERA.lookAt).toHaveLength(3);
  });

  // CENTER_CAMERA is the neutral position between zone transitions
  it("CENTER_CAMERA has position and lookAt tuples of length 3", () => {
    expect(CENTER_CAMERA.position).toHaveLength(3);
    expect(CENTER_CAMERA.lookAt).toHaveLength(3);
  });
});
