// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
import { FaInstagram, FaLinkedinIn } from "react-icons/fa";
import { describe, it, expect, vi } from "vitest";

/**
 * Tests for the socials data module — static social media link definitions.
 *
 * Covers:
 *  - Non-empty array export
 *  - Every entry has label, href, icon, description
 *  - All hrefs are valid absolute URLs
 *  - Instagram entries: correct accounts with canonical trailing-slash URLs
 *  - LinkedIn entry: points to correct profile
 *  - Shape: icon is truthy, no duplicate hrefs
 *
 * Mocks: react-icons/fa (string stubs since we only test data shape, not rendering).
 */

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

// Mock react-icons — we only test the data shape, not icon rendering.
// String stubs satisfy the import without pulling in React JSX.
vi.mock("react-icons/fa", () => ({
  FaInstagram: "FaInstagram",
  FaLinkedinIn: "FaLinkedinIn",
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("lib/socials", () => {
  it("exports a non-empty socials array", async () => {
    const { socials } = await import("./socials");
    expect(Array.isArray(socials)).toBe(true);
    expect(socials.length).toBeGreaterThan(0);
  });

  it("every entry has label, href, icon, and description fields", async () => {
    const { socials } = await import("./socials");
    for (const s of socials) {
      expect(typeof s.label).toBe("string");
      expect(s.label.length).toBeGreaterThan(0);
      expect(typeof s.href).toBe("string");
      expect(s.href.length).toBeGreaterThan(0);
      expect(s.icon).toBeTruthy();
      expect(typeof s.description).toBe("string");
    }
  });

  it("all href values are valid absolute URLs", async () => {
    const { socials } = await import("./socials");
    for (const s of socials) {
      expect(() => new URL(s.href)).not.toThrow();
      expect(s.href).toMatch(/^https?:\/\//);
    }
  });

  describe("Instagram entries", () => {
    it("includes at least one Instagram social link", async () => {
      const { socials } = await import("./socials");
      const instagram = socials.filter((s) => s.href.includes("instagram.com"));
      expect(instagram.length).toBeGreaterThan(0);
    });

    it("all Instagram hrefs point to instagram.com", async () => {
      const { socials } = await import("./socials");
      const instagram = socials.filter((s) => s.icon === FaInstagram);
      for (const s of instagram) {
        expect(s.href).toContain("instagram.com");
      }
    });

    it("Instagram hrefs end with a trailing slash (canonical Instagram URL format)", async () => {
      const { socials } = await import("./socials");
      const instagram = socials.filter((s) => s.href.includes("instagram.com"));
      for (const s of instagram) {
        expect(s.href).toMatch(/\/$/);
      }
    });

    it("contains the @trinitlam personal account", async () => {
      const { socials } = await import("./socials");
      const entry = socials.find((s) => s.label === "@trinitlam");
      expect(entry).toBeDefined();
      expect(entry!.href).toBe("https://www.instagram.com/trinitlam/");
      expect(entry!.description).toBe("Personal");
    });

    it("contains the @lashedbytrini_ lash artistry account", async () => {
      const { socials } = await import("./socials");
      const entry = socials.find((s) => s.label === "@lashedbytrini_");
      expect(entry).toBeDefined();
      expect(entry!.href).toBe("https://www.instagram.com/lashedbytrini_/");
      expect(entry!.description).toBe("Lash artistry");
    });

    it("contains the @linkedbytrini permanent jewelry account", async () => {
      const { socials } = await import("./socials");
      const entry = socials.find((s) => s.label === "@linkedbytrini");
      expect(entry).toBeDefined();
      expect(entry!.href).toContain("linkedbytrini");
    });

    it("contains the @knotsnstuff crochet account", async () => {
      const { socials } = await import("./socials");
      const entry = socials.find((s) => s.label === "@knotsnstuff");
      expect(entry).toBeDefined();
      expect(entry!.href).toBe("https://www.instagram.com/knotsnstuff/");
      expect(entry!.description).toBe("Handmade crochet");
    });
  });

  describe("LinkedIn entry", () => {
    it("includes a LinkedIn social link", async () => {
      const { socials } = await import("./socials");
      const linkedin = socials.filter((s) => s.href.includes("linkedin.com"));
      expect(linkedin.length).toBeGreaterThan(0);
    });

    it("LinkedIn href points to linkedin.com", async () => {
      const { socials } = await import("./socials");
      const entry = socials.find((s) => s.icon === FaLinkedinIn);
      expect(entry).toBeDefined();
      expect(entry!.href).toContain("linkedin.com");
    });

    it("contains the Trini Lam LinkedIn profile", async () => {
      const { socials } = await import("./socials");
      const entry = socials.find((s) => s.label === "Trini Lam");
      expect(entry).toBeDefined();
      expect(entry!.href).toContain("linkedin.com/in/trini-lam");
      expect(entry!.description).toBe("Professional");
    });
  });

  describe("SocialLink shape", () => {
    it("icon field is a truthy value (function or string in test env)", async () => {
      const { socials } = await import("./socials");
      for (const s of socials) {
        expect(s.icon).toBeTruthy();
      }
    });

    it("no two entries share the same href", async () => {
      const { socials } = await import("./socials");
      const hrefs = socials.map((s) => s.href);
      const unique = new Set(hrefs);
      expect(unique.size).toBe(hrefs.length);
    });
  });
});
