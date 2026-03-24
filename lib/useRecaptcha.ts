"use client";

import { useEffect, useCallback, useRef } from "react";
import { env } from "@/lib/env";

/**
 * Hook that loads the Google reCAPTCHA v3 script and provides an
 * `executeRecaptcha(action)` function that returns a token string.
 *
 * reCAPTCHA v3 is invisible — no widget is rendered. The token is
 * generated programmatically and sent to the server for verification.
 */
export function useRecaptcha() {
  const readyRef = useRef(false);

  useEffect(() => {
    const siteKey = env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey || typeof window === "undefined") return;
    if (document.querySelector(`script[src*="recaptcha/api.js"]`)) {
      readyRef.current = true;
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.onload = () => {
      readyRef.current = true;
    };
    document.head.appendChild(script);
  }, []);

  const executeRecaptcha = useCallback(async (action: string): Promise<string> => {
    const siteKey = env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey) return "";

    // Wait for grecaptcha to be ready
    const grecaptcha = (
      window as unknown as {
        grecaptcha?: {
          ready: (cb: () => void) => void;
          execute: (key: string, opts: { action: string }) => Promise<string>;
        };
      }
    ).grecaptcha;
    if (!grecaptcha) return "";

    return new Promise<string>((resolve) => {
      grecaptcha.ready(async () => {
        try {
          const token = await grecaptcha.execute(siteKey, { action });
          resolve(token);
        } catch {
          resolve("");
        }
      });
    });
  }, []);

  return { executeRecaptcha };
}
