import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Only import @testing-library/react in jsdom environments.
// Node-environment tests (Inngest functions, etc.) don't have a DOM and
// @testing-library/react requires @testing-library/dom which isn't installed.
if (typeof window !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => {
    cleanup();
  });
}
