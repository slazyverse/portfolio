#!/usr/bin/env node
/**
 * What the city actually costs, measured rather than declared.
 *
 * The generator publishes a `drawCalls` figure and the laboratory displays it,
 * but that is a number the code says about itself. Phase 5C found it wrong by
 * two, and the only way to know is to count what reaches the driver.
 *
 * So this counts at the boundary: every `draw*` entry point on both WebGL
 * prototypes is wrapped before the page's own scripts run, which means no
 * source file has to carry a measurement hook into production. Triangles come
 * from the same call arguments — element count over three, multiplied by the
 * instance count where there is one.
 *
 *   npm run build && npm start
 *   node scripts/city-metrics.mjs [--url URL] [--json FILE]
 *
 * Frame rate here is a *relative* figure. It is measured under a software
 * rasteriser in a headless browser and says nothing about a real GPU; it is
 * useful only for comparing two commits on the same machine, which is exactly
 * what a before-and-after needs.
 */
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = flag("--url", "http://127.0.0.1:3000");
const JSON_OUT = flag("--json", null);

/** The laboratory takes level, tier and mode as URL parameters. */
const CASES = [
  { name: "surface  HIGH", level: "surface", tier: "high" },
  { name: "surface  BAL ", level: "surface", tier: "balanced" },
  { name: "surface  LOW ", level: "surface", tier: "low" },
  { name: "interface HIGH", level: "interface", tier: "high" },
  { name: "engine   HIGH", level: "engine", tier: "high" },
  { name: "substrate HIGH", level: "substrate", tier: "high" },
];

const PROBE = () => {
  const state = {
    frames: 0,
    calls: 0,
    tris: 0,
    peakCalls: 0,
    peakTris: 0,
    started: 0,
  };
  window.__cityProbe = state;

  const TRIANGLES = 4; // gl.TRIANGLES
  const patch = (proto) => {
    if (!proto) return;
    const wrap = (name, count) => {
      const original = proto[name];
      if (typeof original !== "function") return;
      proto[name] = function (...a) {
        state.calls += 1;
        state.tris += count(a);
        return original.apply(this, a);
      };
    };
    wrap("drawElements", (a) => (a[0] === TRIANGLES ? a[1] / 3 : 0));
    wrap("drawArrays", (a) => (a[0] === TRIANGLES ? a[2] / 3 : 0));
    wrap("drawElementsInstanced", (a) => (a[0] === TRIANGLES ? (a[1] / 3) * a[4] : 0));
    wrap("drawArraysInstanced", (a) => (a[0] === TRIANGLES ? (a[2] / 3) * a[3] : 0));
  };
  patch(window.WebGLRenderingContext?.prototype);
  patch(window.WebGL2RenderingContext?.prototype);

  // A frame is a request-animation-frame turn that issued at least one draw.
  // Counting rAF turns alone would count the ones three.js skips on demand.
  const raf = window.requestAnimationFrame.bind(window);
  const tick = () => {
    const calls = state.calls;
    const tris = state.tris;
    raf(() => {
      if (state.calls > calls) {
        state.frames += 1;
        // Peak rather than last. A single frame is a poor sample on a
        // software rasteriser — an on-demand invalidate can be caught
        // mid-render — and what a budget cares about is the worst frame
        // anyway.
        state.peakCalls = Math.max(state.peakCalls, state.calls - calls);
        state.peakTris = Math.max(state.peakTris, state.tris - tris);
      }
      tick();
    });
  };
  state.started = performance.now();
  tick();
};

const browser = await chromium.launch();
const results = [];

for (const testCase of CASES) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(PROBE);
  const page = await context.newPage();

  const url = `${BASE}/system?level=${testCase.level}&tier=${testCase.tier}&mode=webgl&wide=1`;
  await page.goto(url, { waitUntil: "networkidle" });

  // Let the city build and settle before anything is counted. The first
  // seconds are geometry merging and texture generation, which is a different
  // question from what a resting frame costs.
  await page.waitForTimeout(6000);
  await page.evaluate(() => {
    const s = window.__cityProbe;
    s.frames = 0;
    s.calls = 0;
    s.tris = 0;
    s.peakCalls = 0;
    s.peakTris = 0;
    s.started = performance.now();
  });

  await page.waitForTimeout(6000);

  const m = await page.evaluate(() => {
    const s = window.__cityProbe;
    const seconds = (performance.now() - s.started) / 1000;
    return {
      frames: s.frames,
      fps: s.frames / seconds,
      drawCalls: s.peakCalls,
      triangles: Math.round(s.peakTris),
      declared: document.body.innerText.match(/draw calls\s*(\d+)/i)?.[1] ?? null,
    };
  });

  results.push({ ...testCase, ...m });
  console.log(
    `${testCase.name}  draws ${String(m.drawCalls).padStart(4)}` +
      `  tris ${String(m.triangles).padStart(8)}` +
      `  fps ${m.fps.toFixed(1).padStart(6)}` +
      `  (${m.frames} frames)`,
  );

  await context.close();
}

await browser.close();

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify(results, null, 2));
  console.log(`\nwrote ${JSON_OUT}`);
}
