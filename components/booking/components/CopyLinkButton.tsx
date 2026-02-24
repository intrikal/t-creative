"use client";

/**
 * CopyLinkButton.tsx — Clipboard copy button for the studio booking link.
 *
 * Uses `navigator.clipboard.writeText` (async Clipboard API — requires HTTPS
 * or localhost). Shows a check icon for 2 seconds after a successful copy,
 * then resets to the default copy state. Fully self-contained — no state or
 * callbacks need to be managed by the parent.
 *
 * ## Phase 2 note
 * The URL currently constructs a plain booking link. Phase 2 may append a
 * personalised referral code as a query param (e.g. `?ref=CLIENT_ID`) to
 * track referred bookings and award loyalty points automatically.
 */

import { useState } from "react";
import { LuCopy, LuCheck, LuInstagram } from "react-icons/lu";

/**
 * CopyLinkButton — copies the studio's booking URL to the system clipboard.
 *
 * @param slug             - The studio's URL slug, used to build the full booking URL.
 * @param instagramHandle  - If present, renders a secondary "Share on Instagram" link
 *                           that opens the studio's profile in a new tab.
 */
export function CopyLinkButton({
  slug,
  instagramHandle,
}: {
  slug: string;
  instagramHandle: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const url = `https://tcreativestudio.com/book/${slug}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    // Auto-reset after 2 seconds so the button is reusable without a page reload.
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={handleCopy}
        className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-600 active:scale-95"
      >
        {copied ? <LuCheck className="h-4 w-4" /> : <LuCopy className="h-4 w-4" />}
        {copied ? "Copied!" : "Copy booking link"}
      </button>
      {instagramHandle && (
        <a
          href={`https://instagram.com/${instagramHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
        >
          <LuInstagram className="h-4 w-4 text-rose-500" />
          Share on Instagram
        </a>
      )}
    </div>
  );
}
