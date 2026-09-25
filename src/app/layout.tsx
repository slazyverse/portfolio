import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { SITE } from "@/data/site";
import { Footer } from "@/components/layout/Footer";
import { SystemChrome } from "@/components/chrome/SystemChrome";
import { Environment } from "@/components/environment/Environment";
import { MotionProvider } from "@/components/providers/MotionProvider";
import { RouteAnnouncer } from "@/components/layout/RouteAnnouncer";
import { SIGNAL_DEADLINE_MS } from "@/lib/environment/entry-policy";
import "./globals.css";

/**
 * Both faces are self-hosted at build time by next/font — no request leaves the
 * page for a font, and no layout shift while one loads. The `wdth` axis is what
 * lets stratum labels compress into signage without a third family.
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.statement}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: `${SITE.name} portfolio`,
  authors: [{ name: SITE.name, url: SITE.github }],
  creator: SITE.name,
  keywords: [
    "backend engineer",
    "systems engineer",
    "Go",
    "concurrency",
    "FastAPI",
    "PostGIS",
    "Next.js",
    SITE.name,
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "profile",
    locale: "en_IN",
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.statement}`,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.statement}`,
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

/**
 * SUBSTRATE is dark-only. The light theme was removed in Phase 2: a diegetic
 * system interface with a daylight mode is incoherent, and maintaining two
 * verified palettes doubled the contrast surface for no gain. Readers who need
 * a different rendering are served by forced-colors and the print stylesheet.
 */
export const viewport: Viewport = {
  themeColor: "#090d13",
  colorScheme: "dark",
};

/**
 * Resolves the motion preference before first paint, so the page never renders
 * a frame under the wrong contract. Inline by necessity — anything deferred is
 * too late.
 *
 * `data-motion` is the single source of truth that both CSS and JS read, which
 * is why it is set here rather than left to hydration.
 */
const NO_FLASH = `
try {
  var d = document.documentElement;
  var m = localStorage.getItem("motion");
  if (m !== "full" && m !== "reduced") {
    m = matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full";
  }
  d.setAttribute("data-motion", m);

  // The landing opening, decided before the first paint for the same reason
  // the motion contract is. React cannot make this call early enough: by the
  // time it hydrates, the hero has already been painted in its final state,
  // and hiding it then is a flash of the ending followed by the beginning.
  //
  // Only two of the four inputs are knowable this early — the motion
  // preference and whether this browser has already been shown the opening.
  // That is deliberately the conservative half: both can only *prevent* an
  // opening. Whether the device can render a city at all is settled after
  // hydration, and if the answer is no the store clears this within a frame.
  //
  // The timeout is the safety net for one case only: the bundle never runs.
  // Without it this attribute would hold the hero hidden forever, so it
  // expires on its own and the page is simply the page.
  //
  // It is not the mechanism that ends a normal wait. The landing store owns
  // the same deadline, works backwards from it, and settles at or before this
  // point in every path — which is why this can no longer contradict a
  // cinematic that is still coming. Both read ${SIGNAL_DEADLINE_MS} from one
  // constant so they cannot drift apart.
  if (location.pathname === "/" && m === "full" &&
      !sessionStorage.getItem("substrate:signal-seen")) {
    d.setAttribute("data-signal", "pending");
    setTimeout(function () {
      if (d.getAttribute("data-signal") === "pending") {
        d.setAttribute("data-signal", "ready");
      }
    }, ${SIGNAL_DEADLINE_MS});
  }
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: SITE.name,
    url: SITE.url,
    email: `mailto:${SITE.email}`,
    jobTitle: SITE.role,
    description: SITE.description,
    alumniOf: {
      "@type": "CollegeOrUniversity",
      name: "Lovely Professional University",
    },
    knowsAbout: [
      "Go",
      "Concurrency",
      "FastAPI",
      "PostgreSQL",
      "PostGIS",
      "TypeScript",
      "Next.js",
      "Docker",
    ],
    sameAs: [SITE.github, SITE.linkedin],
  };

  return (
    <html
      lang="en"
      // The no-flash script below sets data-motion before React hydrates, so
      // the server and client values legitimately differ on first paint.
      suppressHydrationWarning
      className={`${archivo.variable} ${jetbrains.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: NO_FLASH }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
        />
      </head>
      <body>
        <a href="#main" className="skip">
          Skip to content
        </a>

        <MotionProvider>
          {/* The procedural environment. Mounted in the layout for the same
              reason the chrome is — it persists across navigation, so the city
              is generated once and a route change moves the camera rather than
              rebuilding the world. Decorative and inert by construction:
              aria-hidden, no pointer events, nothing focusable, no content. */}
          <Environment />

          {/* Announces route changes and moves focus to the main region.
              Client navigation does not reload the document, so without this a
              screen-reader user hears nothing when the route changes. */}
          <RouteAnnouncer />

          {/* Mounted in the layout so it persists across navigation: App
              Router keeps layout components mounted, so the chrome is never
              remounted and never flashes. */}
          <SystemChrome>
            <div className="mx-auto max-w-[1180px] px-5 md:px-12">{children}</div>
            <Footer />
          </SystemChrome>
        </MotionProvider>
      </body>
    </html>
  );
}
