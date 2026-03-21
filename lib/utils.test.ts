// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
import { describe, it, expect } from "vitest";
// cn: className merge utility — combines clsx (conditional classes) with tailwind-merge
// (deduplicates conflicting Tailwind utilities so the last one wins)
import { cn } from "./utils";

/**
 * Tests for the cn() utility — the single class name helper used across all components.
 *
 * Covers:
 *  - Single class passthrough
 *  - Multiple class joining
 *  - Falsy value filtering (false, null, undefined)
 *  - Conditional object syntax { active: true }
 *  - Array syntax
 *  - Tailwind conflict resolution (px-4 + px-6 → px-6)
 *  - Edge cases: no arguments, all-falsy inputs, mixed arrays + strings
 */
describe("lib/utils", () => {
  // Tests for the cn() className merge utility
  describe("cn()", () => {
    it("returns a single class unchanged", () => {
      expect(cn("px-4")).toBe("px-4");
    });

    it("joins multiple classes", () => {
      expect(cn("px-4", "py-2", "text-sm")).toBe("px-4 py-2 text-sm");
    });

    it("ignores falsy values", () => {
      expect(cn("px-4", false, null, undefined, "py-2")).toBe("px-4 py-2");
    });

    it("handles conditional object syntax", () => {
      expect(cn("base", { active: true, disabled: false })).toBe("base active");
    });

    it("handles array syntax", () => {
      expect(cn(["px-4", "py-2"])).toBe("px-4 py-2");
    });

    // tailwind-merge resolves conflicts — the last class in the same utility group wins
    it("resolves conflicting Tailwind classes — last wins", () => {
      expect(cn("px-4", "px-6")).toBe("px-6");
    });

    it("resolves conflicting padding utilities", () => {
      expect(cn("p-4", "px-8")).toBe("p-4 px-8");
    });

    it("resolves conflicting text-color utilities", () => {
      expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    });

    it("returns empty string when no arguments provided", () => {
      expect(cn()).toBe("");
    });

    it("returns empty string for all-falsy inputs", () => {
      expect(cn(false, null, undefined)).toBe("");
    });

    it("handles mixed arrays and strings", () => {
      expect(cn(["text-sm", "font-bold"], "underline")).toBe("text-sm font-bold underline");
    });
  });
});
