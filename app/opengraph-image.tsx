/**
 * opengraph-image — Dynamic OG image generation for the homepage.
 *
 * Uses Next.js ImageResponse to generate a branded social preview image
 * at build time. Displayed when the URL is shared on social platforms.
 */
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "T Creative Studio — Premium Beauty & Creative Services in San Jose";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
          gap: "24px",
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 300,
            color: "#2C2420",
            letterSpacing: "-0.02em",
            textAlign: "center",
            lineHeight: 1.1,
          }}
        >
          T Creative Studio
        </div>
        <div
          style={{
            width: 60,
            height: 1,
            backgroundColor: "#C4907A",
          }}
        />
        <div
          style={{
            fontSize: 24,
            color: "#6B5D52",
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
            textAlign: "center",
          }}
        >
          Lash Extensions · Permanent Jewelry · Crochet · Consulting
        </div>
        <div
          style={{
            fontSize: 18,
            color: "#8B7668",
            marginTop: 8,
          }}
        >
          San Jose, California
        </div>
      </div>
    </div>,
    { ...size },
  );
}
