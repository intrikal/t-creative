import { describe, it, expect } from "vitest";
import { cadenceLabelToRRule, rruleToCadenceLabel, CADENCE_OPTIONS } from "./cadence";

describe("cadence", () => {
  describe("cadenceLabelToRRule", () => {
    it("maps 'Every week' to FREQ=WEEKLY;INTERVAL=1", () => {
      expect(cadenceLabelToRRule("Every week")).toBe("FREQ=WEEKLY;INTERVAL=1");
    });

    it("maps 'Every 3 weeks' to FREQ=WEEKLY;INTERVAL=3", () => {
      expect(cadenceLabelToRRule("Every 3 weeks")).toBe("FREQ=WEEKLY;INTERVAL=3");
    });

    it("maps 'Every month' to FREQ=MONTHLY;INTERVAL=1", () => {
      expect(cadenceLabelToRRule("Every month")).toBe("FREQ=MONTHLY;INTERVAL=1");
    });

    it("maps 'Does not repeat' to empty string", () => {
      expect(cadenceLabelToRRule("Does not repeat")).toBe("");
    });

    it("returns empty string for unknown labels", () => {
      expect(cadenceLabelToRRule("Every 99 weeks")).toBe("");
      expect(cadenceLabelToRRule("")).toBe("");
    });

    it("maps all defined options correctly", () => {
      for (const opt of CADENCE_OPTIONS) {
        expect(cadenceLabelToRRule(opt.label)).toBe(opt.rrule);
      }
    });
  });

  describe("rruleToCadenceLabel", () => {
    it("maps FREQ=WEEKLY;INTERVAL=1 to 'Every week'", () => {
      expect(rruleToCadenceLabel("FREQ=WEEKLY;INTERVAL=1")).toBe("Every week");
    });

    it("maps FREQ=WEEKLY;INTERVAL=6 to 'Every 6 weeks'", () => {
      expect(rruleToCadenceLabel("FREQ=WEEKLY;INTERVAL=6")).toBe("Every 6 weeks");
    });

    it("maps FREQ=MONTHLY;INTERVAL=1 to 'Every month'", () => {
      expect(rruleToCadenceLabel("FREQ=MONTHLY;INTERVAL=1")).toBe("Every month");
    });

    it("returns empty string for empty rrule", () => {
      expect(rruleToCadenceLabel("")).toBe("");
    });

    it("returns the rrule itself for unknown values", () => {
      expect(rruleToCadenceLabel("FREQ=DAILY;INTERVAL=1")).toBe("FREQ=DAILY;INTERVAL=1");
    });

    it("maps all defined options correctly", () => {
      for (const opt of CADENCE_OPTIONS) {
        if (opt.rrule) {
          expect(rruleToCadenceLabel(opt.rrule)).toBe(opt.label);
        }
      }
    });
  });
});
