import posthog from "posthog-js";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key) {
  posthog.init(key, {
    // Route through our reverse proxy (/ingest → us.i.posthog.com)
    // so ad-blockers don't intercept tracking requests.
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false, // Captured manually via PostHogPageview component
    capture_pageleave: true,
    session_recording: {
      recordCrossOriginIframes: true,
    },
  });
}
