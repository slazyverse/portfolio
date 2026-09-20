/**
 * Parses the design tokens straight out of the stylesheets.
 *
 * The contrast suite must assert against the values the browser actually gets,
 * not against a copy maintained by hand. A hand-maintained copy is exactly how
 * the original palette documentation drifted: the CSS claimed every pairing
 * cleared AA while `--color-l0` was being used as a surface with light-theme
 * inks on top of it, at 1.07:1.
 *
 * Phase 2 split the system into tiers, so this reads two files:
 *   styles/tokens.css   Tier 1 raw values, Tier 2 semantic aliases
 *   styles/levels.css   Tier 3 per-level grounds
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const TOKENS_CSS = read("src/styles/tokens.css");
const LEVELS_CSS = read("src/styles/levels.css");

/** Takes a selector's body, balancing braces so nested rules do not truncate. */
function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`No such block: ${selector}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const out: Record<string, string> = {};
  for (const m of css.slice(open + 1, end).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]!.trim()] = m[2]!.trim();
  }
  return out;
}

const theme = block(TOKENS_CSS, "@theme");
const root = block(TOKENS_CSS, ":root {");

/** Resolves `var(--x)` chains down to a literal colour. */
function resolve(value: string): string {
  let v = value;
  for (let i = 0; i < 10; i += 1) {
    const m = v.match(/^var\((--[\w-]+)\)$/);
    if (!m) return v.trim();
    const next = root[m[1]!] ?? theme[m[1]!];
    if (next === undefined) throw new Error(`Unresolved token: ${m[1]}`);
    v = next;
  }
  throw new Error(`Token resolution did not converge for: ${value}`);
}

export function token(name: string): string {
  const raw = root[name] ?? theme[name];
  if (raw === undefined) throw new Error(`Missing token: ${name}`);
  return resolve(raw);
}

/** The per-level grounds from Tier 3, which text also sits on. */
export function levelGrounds(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const level of ["surface", "interface", "engine", "substrate"]) {
    const b = block(LEVELS_CSS, `[data-level="${level}"]`);
    const g = b["--level-ground"];
    if (!g) throw new Error(`Level ${level} declares no --level-ground`);
    out[`level:${level}`] = g.startsWith("var(") ? resolve(g) : g;
  }
  return out;
}

/** Every token used as a text colour. */
export const FOREGROUNDS = [
  "--fg-hi",
  "--fg",
  "--fg-mid",
  "--fg-low",
  "--accent",
  "--cold",
  "--state-safe",
  "--state-unsafe",
  "--state-waiting",
] as const;

/**
 * Every token used as a background behind text — including `--raised`, which
 * carries hover states, and `--deep`, which carries code panels and the footer.
 * The original 48-pairing check omitted both, which is why two real failures
 * went unnoticed.
 */
export const SURFACES = ["--ground", "--panel", "--raised", "--deep"] as const;

// ---- WCAG 2.1 relative luminance / contrast ratio ----

export function parseHex(hex: string): [number, number, number] {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`Not a hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  const lin = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
