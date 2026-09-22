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

/** Level, tier, render mode. `null` keeps whatever is already selected. */
const SHOTS = [
  { name: "01-surface-high", level: "00 Surface", tier: "high", mode: "webgl" },
  { name: "02-interface-high", level: "01 Interface", tier: "high", mode: "webgl" },
  { name: "03-engine-high", level: "02 Engine", tier: "high", mode: "webgl" },
  { name: "04-substrate-high", level: "03 Substrate", tier: "high", mode: "webgl" },
  { name: "05-surface-balanced", level: "00 Surface", tier: "balanced", mode: "webgl", wide: false },
  { name: "06-surface-low-canvas", level: "00 Surface", tier: "low", mode: "canvas", wide: false },
  { name: "07-surface-css", level: "00 Surface", tier: "low", mode: "css", wide: false },
  // The city must still be there under reduced motion, and still.
  {
    name: "08-surface-reduced-motion",
    level: "00 Surface",
    tier: "high",
    mode: "webgl",
    reducedMotion: true,
  },
  // And one of a real content route, with the chrome and the legibility scrim
  // in place — the only way anyone actually sees this in production.
  { name: "09-record-in-context", path: "/record" },
  { name: "10-contracts-in-context", path: "/contracts" },
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
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      reducedMotion: shot.reducedMotion ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    page.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("WebSocket")) {
        console.error("  page error:", m.text().slice(0, 140));
      }
    });

    const choose = async (label) => {
      const button = page.getByRole("button", { name: label, exact: true }).first();
      if ((await button.count()) === 0) throw new Error(`no control named "${label}"`);
      // Dispatched rather than clicked: Playwright's click waits for the
      // element to be "stable", and this page runs entrance reveals with
      // motion enabled — the state the city has to be reviewed in.
      await button.dispatchEvent("click");
      await page.waitForTimeout(400);
    };

    await page.goto(`${URL_BASE}${shot.path ?? "/system"}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);

    if (!shot.path) {
      // Controls first, full bleed second: the stage covers the whole viewport
      // once open, so with it open every later click lands on the canvas.
      if (shot.level) await choose(shot.level);
      if (shot.tier) await choose(shot.tier);

      // A tier change tears the renderer down and builds a new one, and on a
      // software rasteriser that takes real time. Wait for the canvas to come
      // back *before* touching anything else — clicking on into a half-built
      // renderer is what made this hang.
      if (shot.mode === "webgl") {
        await page
          .locator("canvas")
          .first()
          .waitFor({ state: "attached", timeout: 60000 });
        await page.waitForTimeout(1500);
      }

      if (shot.mode) await choose(shot.mode);

      // Full bleed only where the frame is the subject. The tier and fallback
      // comparisons read perfectly well in the panel, and every extra
      // container change is another chance for the renderer to be caught
      // mid-rebuild.
      if (shot.wide !== false) await choose("full bleed");
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
