#!/usr/bin/env node
/**
 * Performance budget gate.
 *
 * Measures what actually reaches a first-time visitor rather than what a glob
 * happens to match: the initial JS figure is the gzipped sum of exactly the
 * chunks the prerendered HTML references, so the lazy three.js chunk is
 * excluded by construction — and would be caught immediately if it ever
 * stopped being lazy.
 *
 * Run after `next build`. Exits non-zero on breach.
 */
import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const KB = 1024;

/** Budgets in KB (gzipped where the metric says so). */
const BUDGET = {
  // 200 KB is the architectural target and it is not negotiable.
  //
  // Phase 1's security patch pushed this to 202.3 and the ceiling was
  // temporarily held at 205. Phase 2 paid that back by deleting anime.js —
  // 21.5 KB gzipped to orchestrate one two-element stagger that the native Web
  // Animations API does for free — bringing the entry to 189.4 KB.
  //
  // The rule is optimise first, then add. Raising this number to make a
  // feature fit is the failure mode this gate exists to prevent.
  initialJs: 200,
  lazyWebgl: 300,
  css: 16,
  fontsPreloaded: 130,
};

const NEXT = ".next";
const HTML = join(NEXT, "server/app/index.html");

function gzKB(path) {
  return gzipSync(readFileSync(path)).length / KB;
}

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

let html;
try {
  html = readFileSync(HTML, "utf8");
} catch {
  console.error(`Cannot read ${HTML} — run \`npm run build\` first.`);
  process.exit(1);
}

// --- initial JS: exactly the chunks the entry HTML pulls in ---
const referenced = [...new Set([...html.matchAll(/static\/chunks\/[\w-]+\.js/g)].map((m) => m[0]))];
const initialJs = referenced.reduce((sum, c) => sum + gzKB(join(NEXT, c)), 0);

// --- the lazy WebGL chunk: the largest chunk NOT referenced by the entry ---
const allChunks = walk(join(NEXT, "static/chunks")).filter((f) => f.endsWith(".js"));
const lazy = allChunks
  .filter((f) => !referenced.some((r) => f.endsWith(r.replace("static/chunks/", ""))))
  .map((f) => ({ f, kb: gzKB(f) }))
  .sort((a, b) => b.kb - a.kb)[0];

// --- CSS ---
const css = walk(join(NEXT, "static")).filter((f) => f.endsWith(".css"))
  .reduce((sum, f) => sum + gzKB(f), 0);

// --- preloaded fonts (raw bytes; woff2 is already compressed) ---
const fontHrefs = [...html.matchAll(/href="([^"]*static\/media\/[^"]+\.woff2)"[^>]*as="font"/g)].map((m) => m[1]);
const fonts = fontHrefs.reduce((sum, h) => sum + statSync(join(NEXT, h.replace("/_next/", ""))).size / KB, 0);

const checks = [
  ["initial JS (gz)", initialJs, BUDGET.initialJs, `${referenced.length} chunks`],
  ["lazy WebGL (gz)", lazy ? lazy.kb : 0, BUDGET.lazyWebgl, lazy ? "held out of entry" : "none"],
  ["CSS (gz)", css, BUDGET.css, ""],
  ["fonts preloaded", fonts, BUDGET.fontsPreloaded, `${fontHrefs.length} files`],
];

let failed = 0;
console.log("\nSUBSTRATE // performance budget\n");
for (const [name, actual, limit, note] of checks) {
  const ok = actual <= limit;
  if (!ok) failed += 1;
  const bar = ok ? "PASS" : "FAIL";
  console.log(
    `  ${bar}  ${name.padEnd(18)} ${actual.toFixed(1).padStart(7)} KB  /  ${String(limit).padStart(3)} KB` +
      (note ? `   ${note}` : ""),
  );
}

// The lazy chunk must stay lazy. If three.js ever lands in the entry, the
// initial figure above would absorb it silently — so assert it directly.
const threeInEntry = referenced.some((c) => gzKB(join(NEXT, c)) > 150);
if (threeInEntry) {
  console.log("\n  FAIL  a >150 KB chunk is in the initial HTML — three.js is no longer lazy");
  failed += 1;
}

console.log(failed ? `\n${failed} budget breach(es)\n` : "\nAll budgets within limit\n");
process.exit(failed ? 1 : 0);
