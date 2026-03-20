"use client";

import { useState } from "react";
import { SetupBanner } from "./AdminSetupBanner";
import type { DashboardPageProps } from "../admin-dashboard-types";

export function SetupBannerWrapper({
  setup,
  bookingSlug,
}: {
  setup: NonNullable<DashboardPageProps["setup"]>;
  bookingSlug: string;
}) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("tc:setup-banner-dismissed") === "true";
  });

  if (dismissed) return null;

  function handleDismiss() {
    localStorage.setItem("tc:setup-banner-dismissed", "true");
    setDismissed(true);
  }

  return <SetupBanner setup={setup} bookingSlug={bookingSlug} onDismiss={handleDismiss} />;
}
