/**
 * Dossier screenshots, for looking at the thing.
 *
 * The structural checks live in the test suites; this exists for the question
 * they cannot answer — whether the first screen of a project page tells you
 * what the project is, and whether the same story survives at phone width.
 *
 * Point it at a running production build:
 *
 *   npm run build && npm start
 *   node scripts/dossier-shots.mjs [baseUrl]
 *
 * Writes PNGs to .shots/ (gitignored). Deliberately a script rather than a
 * test: a screenshot is evidence for a person, and asserting on pixels is how
 * a suite becomes something everybody learns to re-baseline without looking.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = ".shots";

const SHOTS = [
  { name: "index-desktop", path: "/contracts", w: 1280, h: 800 },
  { name: "index-mobile", path: "/contracts", w: 390, h: 844 },
  { name: "dossier-first-screen", path: "/contracts/apix", w: 1280, h: 800 },
  { name: "dossier-mobile-first", path: "/contracts/apix", w: 390, h: 844 },
  { name: "architecture", path: "/contracts/apix#architecture", w: 1280, h: 900 },
  { name: "decisions", path: "/contracts/deadlockd#decisions", w: 1280, h: 900 },
  { name: "challenges", path: "/contracts/vayu-drishti#challenges", w: 1280, h: 800 },
  { name: "next-iteration", path: "/contracts/apix#next-iteration", w: 1280, h: 800 },
  { name: "readiness", path: "/contracts/deadlockd#still-to-write", w: 1280, h: 800 },
  { name: "architecture-mobile", path: "/contracts/vayu-drishti#architecture", w: 390, h: 844 },
  { name: "verify", path: "/verify", w: 1280, h: 900 },
];

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

for (const shot of SHOTS) {
  const context = await browser.newContext({
    viewport: { width: shot.w, height: shot.h },
    // The environment is decorative and expensive to rasterise in software.
    // These shots are about the document.
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle" });
  // Fragment navigation on first load does not always settle before the
  // screenshot; nudge it and let the scroll finish.
  const hash = shot.path.split("#")[1];
  if (hash) {
    await page.evaluate((id) => document.getElementById(id)?.scrollIntoView(), hash);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${shot.name}.png` });
  console.log(`${shot.name.padEnd(24)} ${shot.w}x${shot.h}  ${shot.path}`);
  await context.close();
}

await browser.close();
