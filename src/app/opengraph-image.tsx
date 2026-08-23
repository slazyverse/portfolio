import { ImageResponse } from "next/og";
import { SITE } from "@/data/site";

export const runtime = "nodejs";
export const alt = `${SITE.name} — ${SITE.statement}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Generated at build time rather than shipped as a static asset, so the card
 * can never drift out of sync with the positioning statement in `site.ts`.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#090D13",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Depth rail, echoing the site's one piece of persistent chrome. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 10,
            background: "#FF9E2C",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              letterSpacing: 6,
              color: "#788495",
              textTransform: "uppercase",
            }}
          >
            {SITE.role}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 104,
              lineHeight: 1.02,
              color: "#E9EEF6",
              letterSpacing: -4,
              fontWeight: 600,
            }}
          >
            Builds the layer
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 104,
              lineHeight: 1.02,
              color: "#FF9E2C",
              letterSpacing: -4,
              fontWeight: 600,
            }}
          >
            underneath
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderTop: "1px solid rgba(232,237,244,0.14)",
            paddingTop: 26,
          }}
        >
          <div style={{ display: "flex", fontSize: 30, color: "#E9EEF6" }}>
            {SITE.name}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#788495" }}>
            {SITE.githubHandle}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
