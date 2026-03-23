/**
 * generate-og-image — Reusable OG image generator for public pages.
 *
 * Returns an `ImageResponse` (1200×630 PNG) with studio branding.
 * Each page calls this with a page-specific title/subtitle/category.
 *
 * Uses the same warm gradient palette as the homepage OG image.
 */
import { ImageResponse } from "next/og";

interface OgImageOptions {
  /** Business name displayed prominently */
  businessName: string;
  /** Page-specific title (e.g. "Our Services") */
  title: string;
  /** Optional subtitle for extra context */
  subtitle?: string;
  /** Optional category label shown as a pill */
  category?: string;
}

export const ogImageSize = { width: 1200, height: 630 };

export function generateOgImage({ businessName, title, subtitle, category }: OgImageOptions) {
  return new ImageResponse(
    <div
      style={{
        background: "linear-gradient(135deg, #FAF6F1 0%, #F3ECE4 40%, #E8C4B8 100%)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          maxWidth: 900,
          padding: "0 60px",
        }}
      >
        {/* Business name */}
        <div
          style={{
            fontSize: 32,
            fontWeight: 400,
            color: "#6B5D52",
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            marginBottom: 20,
          }}
        >
          {businessName}
        </div>

        {/* Divider */}
        <div
          style={{
            width: 60,
            height: 1,
            backgroundColor: "#C4907A",
            display: "flex",
            marginBottom: 24,
          }}
        />

        {/* Page title */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 300,
            color: "#2C2420",
            letterSpacing: "-0.02em",
            textAlign: "center",
            lineHeight: 1.15,
            marginBottom: subtitle ? 16 : 0,
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              fontSize: 22,
              color: "#8B7668",
              textAlign: "center",
              lineHeight: 1.5,
              maxWidth: 700,
              marginBottom: category ? 24 : 0,
            }}
          >
            {subtitle}
          </div>
        )}

        {/* Category pill */}
        {category && (
          <div
            style={{
              display: "flex",
              marginTop: subtitle ? 0 : 24,
            }}
          >
            <div
              style={{
                padding: "8px 24px",
                borderRadius: 100,
                backgroundColor: "rgba(196,144,122,0.15)",
                border: "1.5px solid #C4907A",
                color: "#6B5D52",
                fontSize: 16,
                fontWeight: 500,
                letterSpacing: "0.04em",
                display: "flex",
                alignItems: "center",
              }}
            >
              {category}
            </div>
          </div>
        )}
      </div>
    </div>,
    { ...ogImageSize },
  );
}
