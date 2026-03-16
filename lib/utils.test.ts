import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("lib/utils", () => {
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
