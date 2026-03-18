import { describe, it, expect } from "vitest";
import { cadenceLabelToRRule, rruleToCadenceLabel, CADENCE_OPTIONS } from "./cadence";

describe("cadence", () => {
  describe("cadenceLabelToRRule", () => {
    it("returns correct rrule for 'Every week'", () => {
      expect(cadenceLabelToRRule("Every week")).toBe("FREQ=WEEKLY;INTERVAL=1");
    });

    it("returns correct rrule for 'Every 2 weeks'", () => {
      expect(cadenceLabelToRRule("Every 2 weeks")).toBe("FREQ=WEEKLY;INTERVAL=2");
    });

    it("returns empty string for 'Does not repeat'", () => {
      expect(cadenceLabelToRRule("Does not repeat")).toBe("");
    });

    it("returns empty string for unknown label", () => {
      expect(cadenceLabelToRRule("Every 99 years")).toBe("");
    });
  });

  describe("rruleToCadenceLabel", () => {
    it("returns correct label for weekly rrule", () => {
      expect(rruleToCadenceLabel("FREQ=WEEKLY;INTERVAL=1")).toBe("Every week");
    });

    it("returns correct label for monthly rrule", () => {
      expect(rruleToCadenceLabel("FREQ=MONTHLY;INTERVAL=1")).toBe("Every month");
    });

    it("returns empty string for empty input", () => {
      expect(rruleToCadenceLabel("")).toBe("");
    });

    it("returns raw rrule for unknown pattern", () => {
      expect(rruleToCadenceLabel("FREQ=YEARLY;INTERVAL=1")).toBe("FREQ=YEARLY;INTERVAL=1");
    });
  });

  it("all CADENCE_OPTIONS have matching value and rrule", () => {
    for (const opt of CADENCE_OPTIONS) {
      expect(opt.value).toBe(opt.rrule);
    }
  });
});
