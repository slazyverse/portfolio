import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { SITE } from "@/data/site";
import { SiteNav } from "@/components/layout/SiteNav";
import { DepthRail } from "@/components/layout/DepthRail";
import { Footer } from "@/components/layout/Footer";
import { MotionProvider } from "@/components/providers/MotionProvider";
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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090d13" },
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
  ],
  colorScheme: "dark light",
};

/**
 * Applied before first paint so a stored light-theme preference never flashes
 * dark. Inline by necessity — anything deferred is too late.
 */
const NO_FLASH = `
try {
  var d = document.documentElement;
  var t = localStorage.getItem("theme");
  if (t === "light" || t === "dark") d.setAttribute("data-theme", t);

  var m = localStorage.getItem("motion");
  if (m !== "full" && m !== "reduced") {
    m = matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full";
  }
  d.setAttribute("data-motion", m);
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
      data-theme="dark"
      // The no-flash script below rewrites data-theme before React hydrates,
      // so the server and client values legitimately differ on first paint.
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
          <DepthRail />

          <div className="relative z-[1] md:ml-[var(--rail-w)]">
            <SiteNav />
            <div className="mx-auto max-w-[1180px] px-5 md:px-12">{children}</div>
            <Footer />
          </div>
        </MotionProvider>
      </body>
    </html>
  );
}
