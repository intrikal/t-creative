// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
import { describe, it, expect } from "vitest";
// cadenceLabelToRRule: converts a human-readable label like "Every 2 weeks" to an iCalendar RRULE string
// rruleToCadenceLabel: reverse of above — converts an RRULE back to a display label
// CADENCE_OPTIONS: dropdown options for the booking recurrence selector
import { cadenceLabelToRRule, rruleToCadenceLabel, CADENCE_OPTIONS } from "./cadence";

/**
 * Tests for the cadence utility — bidirectional conversion between
 * human-readable recurrence labels and iCalendar RRULE strings.
 *
 * Covers:
 *  - Label → RRULE: known labels, "Does not repeat", unknown labels
 *  - RRULE → Label: known rules, empty input, unknown patterns
 *  - CADENCE_OPTIONS shape: value matches rrule for each option
 *
 * No mocks — these are pure mapping functions.
 */
describe("cadence", () => {
  // Tests for converting user-facing labels to database-stored RRULE strings
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

  // Tests for converting RRULE strings back to display labels (used in booking detail views)
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

  // Guard: the dropdown option's value field must equal its rrule so form submissions work
  it("all CADENCE_OPTIONS have matching value and rrule", () => {
    for (const opt of CADENCE_OPTIONS) {
      expect(opt.value).toBe(opt.rrule);
    }
  });
});
