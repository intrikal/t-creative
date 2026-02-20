import { describe, it, expect } from "vitest";
import { ZONES, ZONE_ORDER, HERO_CAMERA, CENTER_CAMERA } from "@/lib/zones";

describe("ZONES", () => {
  const expectedKeys = ["lash", "jewelry", "crochet", "consulting"];

  it("has exactly 4 keys: lash, jewelry, crochet, consulting", () => {
    const keys = Object.keys(ZONES);
    expect(keys).toHaveLength(4);
    expect(keys.sort()).toEqual(expectedKeys.sort());
  });

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
    expect(zone.cameraPosition).toHaveLength(3);
    expect(zone.cameraLookAt).toHaveLength(3);
    expect(zone.cta).toHaveProperty("label");
    expect(zone.cta).toHaveProperty("href");
  });
});

describe("ZONE_ORDER", () => {
  it("contains all 4 zone IDs", () => {
    expect(ZONE_ORDER).toContain("lash");
    expect(ZONE_ORDER).toContain("jewelry");
    expect(ZONE_ORDER).toContain("crochet");
    expect(ZONE_ORDER).toContain("consulting");
  });

  it("length matches ZONES keys length", () => {
    expect(ZONE_ORDER).toHaveLength(Object.keys(ZONES).length);
  });
});

describe("Camera presets", () => {
  it("HERO_CAMERA has position and lookAt tuples of length 3", () => {
    expect(HERO_CAMERA.position).toHaveLength(3);
    expect(HERO_CAMERA.lookAt).toHaveLength(3);
  });

  it("CENTER_CAMERA has position and lookAt tuples of length 3", () => {
    expect(CENTER_CAMERA.position).toHaveLength(3);
    expect(CENTER_CAMERA.lookAt).toHaveLength(3);
  });
});
