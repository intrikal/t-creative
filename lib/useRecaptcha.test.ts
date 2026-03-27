/**
 * lib/useRecaptcha.test.ts
 *
 * Tests for the useRecaptcha() hook.
 *
 * Strategy:
 * - Mock @/lib/env so we can control NEXT_PUBLIC_RECAPTCHA_SITE_KEY per test.
 * - Mock window.grecaptcha to simulate a loaded reCAPTCHA v3 runtime.
 * - Use renderHook + act to drive React lifecycle and the script onload callback.
 * - Inspect document.head for injected <script> tags to verify URL and dedup behaviour.
 */
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* ── env mock ─────────────────────────────────────────────────────────────── */

// Hoist so the factory runs before any imports that reference @/lib/env.
const mockEnv = vi.hoisted(() => ({
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: "test-site-key" as string | undefined,
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

/* ── subject under test ───────────────────────────────────────────────────── */

import { useRecaptcha } from "./useRecaptcha";

/* ── helpers ──────────────────────────────────────────────────────────────── */

/**
 * Fire the onload callback of the most recently injected reCAPTCHA script tag,
 * simulating the browser finishing the network request.
 */
function fireScriptOnload() {
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[src*="recaptcha/api.js"]');
  const last = scripts[scripts.length - 1];
  if (!last) throw new Error("No reCAPTCHA script found in document.head");
  // HTMLScriptElement.onload is typed as EventListener | null; cast for simplicity.
  (last as unknown as { onload: () => void }).onload();
}

/**
 * Install a mock grecaptcha on window that resolves execute() with the given token.
 */
function installGrecaptcha(token = "mock-token") {
  (window as unknown as Record<string, unknown>).grecaptcha = {
    ready: (cb: () => void) => cb(),
    execute: vi.fn().mockResolvedValue(token),
  };
}

function uninstallGrecaptcha() {
  delete (window as unknown as Record<string, unknown>).grecaptcha;
}

/* ── cleanup ──────────────────────────────────────────────────────────────── */

beforeEach(() => {
  // Reset env to the default "key present" state before each test.
  mockEnv.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = "test-site-key";

  // Remove any reCAPTCHA script tags injected by previous tests.
  document.querySelectorAll('script[src*="recaptcha/api.js"]').forEach((el) => el.remove());

  uninstallGrecaptcha();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ── tests ────────────────────────────────────────────────────────────────── */

describe("useRecaptcha()", () => {
  /**
   * 1. executeRecaptcha returns "" (effectively a no-op / pending state) when
   *    the grecaptcha runtime is not yet present on window — which is the
   *    situation immediately after mount before the script finishes loading.
   */
  it("executeRecaptcha returns empty string before the script has loaded", async () => {
    // grecaptcha is NOT installed — script hasn't loaded yet.
    const { result } = renderHook(() => useRecaptcha());

    const token = await result.current.executeRecaptcha("contact_form");

    expect(token).toBe("");
  });

  /**
   * 2. After the script's onload fires and grecaptcha is available,
   *    executeRecaptcha calls grecaptcha.execute with the site key and action,
   *    then returns the token.
   */
  it("executeRecaptcha calls grecaptcha.execute and returns the token after script loads", async () => {
    installGrecaptcha("recaptcha-token-abc");

    const { result } = renderHook(() => useRecaptcha());

    // Simulate the script finishing loading.
    act(() => {
      fireScriptOnload();
    });

    const token = await result.current.executeRecaptcha("submit_form");

    expect(token).toBe("recaptcha-token-abc");

    const grecaptcha = (window as unknown as { grecaptcha: { execute: ReturnType<typeof vi.fn> } })
      .grecaptcha;
    expect(grecaptcha.execute).toHaveBeenCalledWith("test-site-key", { action: "submit_form" });
  });

  /**
   * 3. When NEXT_PUBLIC_RECAPTCHA_SITE_KEY is absent the hook must not inject
   *    a script tag and executeRecaptcha must return "" immediately.
   */
  it("does not inject a script and returns empty string when site key is not set", async () => {
    mockEnv.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = undefined;

    const { result } = renderHook(() => useRecaptcha());

    const scriptsBefore = document.querySelectorAll('script[src*="recaptcha/api.js"]').length;
    const token = await result.current.executeRecaptcha("some_action");

    expect(scriptsBefore).toBe(0);
    expect(document.querySelectorAll('script[src*="recaptcha/api.js"]').length).toBe(0);
    expect(token).toBe("");
  });

  /**
   * 4. Rendering the hook a second time (simulating a remount or a second
   *    component using the same hook) must NOT inject a duplicate <script> tag —
   *    it detects the existing one via document.querySelector and skips injection.
   */
  it("does not inject a second script tag when one is already present in the document", () => {
    // First mount injects the script.
    const { unmount } = renderHook(() => useRecaptcha());
    const countAfterFirst = document.querySelectorAll('script[src*="recaptcha/api.js"]').length;

    // Second mount — same document, script already present.
    renderHook(() => useRecaptcha());
    const countAfterSecond = document.querySelectorAll('script[src*="recaptcha/api.js"]').length;

    expect(countAfterFirst).toBe(1);
    expect(countAfterSecond).toBe(1);

    unmount();
  });

  /**
   * 5. The injected <script> src must contain the site key as the render param
   *    and point at the correct Google reCAPTCHA v3 endpoint.
   */
  it("injects a script tag with the correct src URL containing the site key", () => {
    renderHook(() => useRecaptcha());

    const script = document.querySelector<HTMLScriptElement>('script[src*="recaptcha/api.js"]');

    expect(script).not.toBeNull();
    expect(script!.src).toBe("https://www.google.com/recaptcha/api.js?render=test-site-key");
    expect(script!.async).toBe(true);
  });
});
