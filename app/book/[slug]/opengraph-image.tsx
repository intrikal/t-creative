/**
 * app/book/[slug]/opengraph-image.tsx — Dynamic OG image for /book/[slug]
 *
 * ## What this file does
 * Next.js treats any file named `opengraph-image.tsx` inside a route segment as
 * a special image route. When a social platform (Instagram, iMessage, WhatsApp,
 * Twitter/X, Slack) unfurls a `/book/[slug]` URL, it fetches this endpoint and
 * receives a 1200×630 PNG that becomes the link preview card.
 *
 * Without this file, social shares show a blank grey box. With it, clients
 * sharing the booking link get a branded preview that includes the studio name,
 * bio, and service category pills — driving higher click-through rates.
 *
 * ## Runtime: "nodejs"
 * The default edge runtime cannot access the database (no TCP connections).
 * Setting `runtime = "nodejs"` opts this route into the Node.js runtime so
 * Drizzle/Postgres queries work. The trade-off is slightly slower cold starts
 * vs. edge, but OG image generation is not latency-sensitive (crawlers fetch
 * it once and cache it).
 *
 * ## Rendering engine: next/og ImageResponse
 * `ImageResponse` from `next/og` accepts a React JSX tree and renders it to a
 * PNG using the Satori layout engine. Satori supports a subset of CSS — notably:
 * - ✅ flexbox (display: "flex" required on every container)
 * - ✅ absolute positioning, border-radius, background gradients
 * - ❌ grid, gap (use margin instead), CSS variables, most pseudo-elements
 *
 * Important: every `<div>` must have `display: "flex"` explicitly — Satori
 * does not apply block display by default.
 *
 * ## Data fetching
 * Queries the `profiles` table for the admin whose studio name normalises to
 * the slug. Extracts studio name, bio, and avatar URL. Falls back to generic
 * T Creative Studio copy if the slug doesn't match (rather than erroring).
 *
 * ## Visual structure
 * ┌──────────────────────────────────────────────────────────────┐
 * │  gradient background (rose → warm → violet)                  │
 * │  ╭── decorative blobs (absolute circles, translucent) ───╮   │
 * │  │                                                        │   │
 * │  │  [avatar circle]                                       │   │
 * │  │  Studio Name  (large, serif, font-weight 300)          │   │
 * │  │  Bio text     (small, system-ui)                       │   │
 * │  │  [Lash] [Jewelry] [Crochet] [Consulting] ← pills       │   │
 * │  │  [Book a session]    tcreative.studio/book/slug        │   │
 * │  ╰────────────────────────────────────────────────────────╯   │
 * └──────────────────────────────────────────────────────────────┘
 *
 * ## Phase 2 considerations
 * - Custom fonts (Cormorant/Geist) can be loaded via `fetch()` inside the
 *   function and passed to `ImageResponse({ fonts: [...] })`. Currently using
 *   system serif/sans as Satori font loading adds latency.
 * - Category pills are hardcoded. Phase 2 can derive them from the active
 *   services returned by the DB query to reflect the actual service catalog.
 * - The image is cached by Next.js using the route segment's `revalidate` config.
 *   Add `export const revalidate = 86400` to cache for 24 hours.
 */

import { ImageResponse } from "next/og";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";

export const runtime = "nodejs";
export const alt = "Book a session — T Creative Studio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * OGImage — generates the Open Graph preview image for a studio's booking page.
 *
 * Fetches studio data server-side, then renders a branded PNG via Satori.
 * Falls back gracefully to T Creative Studio defaults if the slug doesn't match.
 *
 * @param params - Next.js dynamic route params. `slug` identifies the studio.
 * @returns A 1200×630 PNG `ImageResponse` suitable for OG/Twitter card meta tags.
 */
export default async function OGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Single query — only the fields needed for the image render.
  const [row] = await db
    .select({
      onboardingData: profiles.onboardingData,
      avatarUrl: profiles.avatarUrl,
    })
    .from(profiles)
    .where(sql`lower(replace(trim(${profiles.onboardingData}->>'studioName'), ' ', '')) = ${slug}`)
    .limit(1);

  const data = row?.onboardingData as Record<string, unknown> | null;
  const studioName = (data?.studioName as string) ?? "T Creative Studio";
  const bio =
    (data?.bio as string) ??
    "A luxury studio specializing in lash extensions, permanent jewelry, crochet & consulting.";
  const avatarUrl = row?.avatarUrl ?? null;

  // Category pills — hardcoded for Phase 1. Colours match the booking page palette.
  const pills = [
    { label: "Lash Extensions", color: "#f43f5e", bg: "#fff1f2" },
    { label: "Permanent Jewelry", color: "#d97706", bg: "#fffbeb" },
    { label: "Crochet", color: "#7c3aed", bg: "#faf5ff" },
    { label: "Consulting", color: "#0d9488", bg: "#f0fdfa" },
  ];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #fff1f2 0%, #fdf8f0 45%, #faf5ff 100%)",
        fontFamily: "Georgia, 'Times New Roman', serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative blobs — absolute-positioned translucent circles for depth */}
      <div
        style={{
          position: "absolute",
          top: -80,
          right: -80,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "rgba(251,207,232,0.35)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -60,
          left: -60,
          width: 240,
          height: 240,
          borderRadius: "50%",
          background: "rgba(253,230,138,0.3)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: -40,
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: "rgba(221,214,254,0.3)",
          display: "flex",
        }}
      />

      {/* Content container */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          zIndex: 1,
          padding: "0 80px",
          maxWidth: 900,
        }}
      >
        {/* Avatar — only rendered when a URL is available */}
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt={studioName}
            width={96}
            height={96}
            style={{
              borderRadius: "50%",
              marginBottom: 24,
              border: "4px solid white",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              objectFit: "cover",
            }}
          />
        )}

        {/* Studio name — font size reduced slightly when avatar is present */}
        <div
          style={{
            fontSize: avatarUrl ? 52 : 60,
            fontWeight: 300,
            letterSpacing: "-1px",
            color: "#1c1917",
            marginBottom: 14,
            lineHeight: 1.1,
          }}
        >
          {studioName}
        </div>

        {/* Bio — truncated visually by maxWidth; Satori doesn't support line-clamp */}
        <div
          style={{
            fontSize: 20,
            color: "#78716c",
            maxWidth: 680,
            lineHeight: 1.5,
            marginBottom: 32,
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: 400,
          }}
        >
          {bio}
        </div>

        {/* Category pills */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 36,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {pills.map(({ label, color, bg }) => (
            <div
              key={label}
              style={{
                padding: "7px 16px",
                borderRadius: 100,
                background: bg,
                border: `1.5px solid ${color}`,
                color,
                fontSize: 14,
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* CTA row — rose "Book a session" button + URL slug */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "13px 32px",
              borderRadius: 100,
              background: "#f43f5e",
              color: "white",
              fontSize: 18,
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontWeight: 700,
              boxShadow: "0 4px 20px rgba(244,63,94,0.35)",
            }}
          >
            Book a session
          </div>
          <div
            style={{
              fontSize: 16,
              color: "#a8a29e",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            tcreative.studio/book/{slug}
          </div>
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
