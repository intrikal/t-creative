"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

/**
 * Client-side PostHog user identification.
 *
 * Rendered inside the dashboard layout (where auth is guaranteed) to link
 * anonymous session recordings and pageviews to the authenticated user.
 * This is the client-side counterpart to the server-side `identifyUser()`
 * call in the auth callback.
 */
// Single-tenant constant — swap for dynamic value when multi-tenant.
const STUDIO_ID = "t-creative";

export function PostHogIdentify({
  userId,
  email,
  role,
  name,
}: {
  userId: string;
  email: string;
  role: string;
  name: string;
}) {
  useEffect(() => {
    if (!userId) return;
    posthog.identify(userId, { email, role, name });
    posthog.group("studio", STUDIO_ID);
  }, [userId, email, role, name]);

  return null;
}
