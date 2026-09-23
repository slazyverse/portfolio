#!/usr/bin/env node
/**
 * Visual QA for the procedural environment.
 *
 * The brief makes visual review mandatory — the city is not finished because
 * the tests pass — and this is the harness for it. It drives the `/system`
 * laboratory through every level, tier and fallback mode, captures each one
 * full bleed, and writes the frames to disk so they can actually be looked at
 * and compared between commits.
 *
 * Scripted rather than done by hand for the usual reason: a review you cannot
 * repeat is an anecdote. The city is deterministic, so two runs of this at the
 * same commit produce identical images, and a diff between commits is a real
 * signal rather than a difference in where someone happened to scroll.
 *
 *   node scripts/city-shots.mjs [--out DIR] [--url URL]
 *
 * Requires the dev or production server to be running.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const OUT = flag("--out", "city-shots");
const URL_BASE = flag("--url", "http://127.0.0.1:3000");

/**
 * One shot each. `level`, `tier` and `mode` are the laboratory's own URL
 * parameters, so every frame is a page the reviewer can open themselves.
 */
const SHOTS = [
  { name: "01-surface-high", level: "surface", tier: "high", mode: "webgl" },
  { name: "02-interface-high", level: "interface", tier: "high", mode: "webgl" },
  { name: "03-engine-high", level: "engine", tier: "high", mode: "webgl" },
  { name: "04-substrate-high", level: "substrate", tier: "high", mode: "webgl" },
  { name: "05-surface-balanced", level: "surface", tier: "balanced", mode: "webgl" },
  { name: "06-surface-low-canvas", level: "surface", tier: "low", mode: "canvas" },
  { name: "07-surface-css", level: "surface", tier: "low", mode: "css" },
  // The city must still be there under reduced motion, and still.
  {
    name: "08-surface-reduced-motion",
    level: "surface",
    tier: "high",
    mode: "webgl",
    reducedMotion: true,
  },
  // And two of a real content route, with the chrome and the legibility scrim
  // in place — the only way anyone actually sees this in production.
  { name: "09-record-in-context", path: "/record" },
  { name: "10-contracts-in-context", path: "/contracts" },
  // And on a phone, where the tier contract forbids WebGL entirely and the
  // environment is a CSS gradient. The point of the shot is that the page is
  // unaffected: same content, same chrome, no hole where a city was.
  { name: "11-record-mobile", path: "/record", mobile: true },
];

mkdirSync(OUT, { recursive: true });

const LAUNCH = {
  args: [
    // Headless Chromium needs to be told to use a software rasteriser for
    // WebGL; without it the context is created and renders nothing, which
    // looks exactly like a bug in the scene.
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
};

const VIEWPORT = { width: 1280, height: 720 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

/**
 * One browser per shot.
 *
 * Every tier change tears down a WebGL context and builds another, and a
 * browser hands out a limited number before it quietly stops — which shows up
 * here as a canvas that never appears, several shots in. Closing pages was not
 * enough; the contexts are reclaimed lazily. A fresh browser per frame is slow
 * and completely reliable, which is the right trade for a script that runs
 * when someone wants to look at the city.
 *
 * The limit itself is a real constraint rather than a harness quirk, and it is
 * the one the environment is designed around: in the product the context is
 * created once and kept for the whole session.
 */
async function capture(shot) {
  const browser = await chromium.launch(LAUNCH);
  try {
    const context = await browser.newContext({
      viewport: shot.mobile ? MOBILE_VIEWPORT : VIEWPORT,
      deviceScaleFactor: 1,
      isMobile: Boolean(shot.mobile),
      hasTouch: Boolean(shot.mobile),
      reducedMotion: shot.reducedMotion ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    page.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("WebSocket")) {
        console.error("  page error:", m.text().slice(0, 140));
      }
    });

    /*
     * Arrive in the state wanted, rather than clicking into it.
     *
     * The first version drove the laboratory's buttons. That worked for the
     * default tier and failed silently for every other one: switching tier in
     * a live page tears down a WebGL context and builds another, and on a
     * software rasteriser the second one frequently never arrived — the
     * "balanced" and "low" frames came back reading "renderer stepped down:
     * WebGL context lost". It also screenshotted the top of the page rather
     * than the stage, so for several rounds the tier comparisons contained no
     * city at all.
     *
     * One navigation, one context, and a URL a reviewer can open themselves.
     */
    const url = shot.path
      ? `${URL_BASE}${shot.path}`
      : `${URL_BASE}/system?${new URLSearchParams({
          level: shot.level,
          tier: shot.tier,
          mode: shot.mode,
          wide: "1",
        })}`;

    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);

    if (!shot.path && shot.mode === "webgl") {
      // The renderer is lazy and the city is built on an idle callback, so
      // the canvas arrives a beat after the page does.
      await page.locator("canvas").first().waitFor({ state: "attached", timeout: 60000 });
      await page.waitForTimeout(1800);
    }

    // Let the camera settle and the weather reach a steady state.
    await page.waitForTimeout(2600);

    // A page screenshot, not an element one: in full bleed the stage fills the
    // viewport, and an element screenshot waits for the element to hold still,
    // which a canvas with rain falling through it never does. The timeout is
    // generous because this runs on a software rasteriser.
    await page.screenshot({ path: join(OUT, `${shot.name}.png`), timeout: 120000 });
    console.log(`  wrote ${shot.name}.png`);
  } finally {
    await browser.close();
  }
}

console.log(`
SUBSTRATE // city visual QA -> ${OUT}
`);

for (const shot of SHOTS) {
  await capture(shot);
}

console.log("done");
