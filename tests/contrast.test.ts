import { describe, expect, it } from "vitest";
import {
  contrast,
  FOREGROUNDS,
  levelGrounds,
  SURFACES,
  token,
} from "./tokens";

/**
 * The contrast gate.
 *
 * The site previously documented "48 pairings, worst 4.78:1" — which was true
 * for the 48 it tested, and those 48 omitted two surfaces that were in active
 * use. `--fg-low` on `--raised` was 4.41:1, and the code panel rendered
 * `--fg-hi` on the raw `--color-l0` ramp value at 1.07:1.
 *
 * This enumerates the full cross-product from the stylesheets themselves, so a
 * new surface, a new ink, or a new level cannot be added without being checked.
 * Phase 2 added the per-level grounds and the cold secondary to the matrix.
 */
const AA_NORMAL = 4.5;
const LEVELS = levelGrounds();

describe("ink on surfaces", () => {
  for (const fg of FOREGROUNDS) {
    for (const bg of SURFACES) {
      it(`${fg} on ${bg} clears AA`, () => {
        const ratio = contrast(token(fg), token(bg));
        expect(
          ratio,
          `${fg} (${token(fg)}) on ${bg} (${token(bg)}) = ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  }
});

describe("ink on every level ground", () => {
  // The page deepens as the reader descends. Ink verified only against the top
  // of the page is ink that has not been verified.
  for (const fg of FOREGROUNDS) {
    for (const [name, ground] of Object.entries(LEVELS)) {
      it(`${fg} on ${name} clears AA`, () => {
        const ratio = contrast(token(fg), ground);
        expect(
          ratio,
          `${fg} (${token(fg)}) on ${name} (${ground}) = ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  }
});

describe("text on accent", () => {
  // The skip link and ::selection put text ON the accent rather than on a
  // surface, which is why --on-accent exists as its own token.
  it("--on-accent on --accent clears AA", () => {
    const ratio = contrast(token("--on-accent"), token("--accent"));
    expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

describe("token hygiene", () => {
  it("every ink and surface resolves to a literal hex colour", () => {
    for (const name of [...FOREGROUNDS, ...SURFACES, "--on-accent"]) {
      expect(token(name), name).toMatch(/^#[0-9a-f]{3,6}$/i);
    }
  });

  it("the surface ramp is strictly ordered, shallow to deep", () => {
    // If two surfaces ever collide, the depth metaphor stops being legible and
    // a panel becomes indistinguishable from the ground it sits on.
    const order = ["--raised", "--panel", "--ground", "--deep"] as const;
    const lums = order.map((t) => {
      const [r, g, b] = [1, 3, 5].map((i) =>
        parseInt(token(t).replace("#", "").slice(i - 1, i + 1), 16),
      );
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    });
    for (let i = 1; i < lums.length; i += 1) {
      expect(lums[i]!, `${order[i]} is not deeper than ${order[i - 1]}`).toBeLessThan(
        lums[i - 1]!,
      );
    }
  });

  it("the cold secondary is distinguishable from the amber signal", () => {
    // Amber means "the subject"; cold means "the system talking about itself".
    // Confusing them would collapse that distinction.
    //
    // Measured as hue distance, not WCAG contrast: these two are deliberately
    // close in lightness (1.09:1) and separated almost entirely by hue, which
    // is precisely what a contrast ratio does not measure.
    const hue = (hex: string) => {
      const [r, g, b] = [0, 2, 4].map(
        (i) => parseInt(hex.replace("#", "").slice(i, i + 2), 16) / 255,
      ) as [number, number, number];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const d = max - min;
      if (d === 0) return 0;
      const h =
        max === r
          ? ((g - b) / d) % 6
          : max === g
            ? (b - r) / d + 2
            : (r - g) / d + 4;
      return ((h * 60) % 360 + 360) % 360;
    };

    const a = hue(token("--accent"));
    const c = hue(token("--cold"));
    const separation = Math.min(Math.abs(a - c), 360 - Math.abs(a - c));
    expect(
      separation,
      `accent ${token("--accent")} (${a.toFixed(0)}deg) vs cold ${token("--cold")} (${c.toFixed(0)}deg) = ${separation.toFixed(0)}deg apart`,
    ).toBeGreaterThan(90);
  });
});
