import { describe, expect, it } from "vitest";
import { contrast, FOREGROUNDS, SURFACES, token, type Theme } from "./tokens";

/**
 * The contrast gate.
 *
 * The site previously documented "48 pairings, worst 4.78:1" — which was true
 * for the 48 it tested, and those 48 omitted two surfaces that were in active
 * use. `--fg-low` on `--raised` was 4.41:1, and in the light theme the code
 * panel rendered `--fg-hi` on the raw `--color-l0` ramp value at 1.07:1.
 *
 * This suite enumerates the full cross-product from the stylesheet itself, so
 * a new surface or ink cannot be added without being checked.
 */
const AA_NORMAL = 4.5;
const THEMES: Theme[] = ["dark", "light"];

describe("palette contrast", () => {
  for (const theme of THEMES) {
    for (const fg of FOREGROUNDS) {
      for (const bg of SURFACES) {
        it(`${theme}: ${fg} on ${bg} clears AA`, () => {
          const ratio = contrast(token(fg, theme), token(bg, theme));
          expect(
            ratio,
            `${theme} ${fg} (${token(fg, theme)}) on ${bg} (${token(bg, theme)}) = ${ratio.toFixed(2)}:1`,
          ).toBeGreaterThanOrEqual(AA_NORMAL);
        });
      }
    }
  }

  // The skip link and ::selection put text ON the accent rather than on a
  // surface. In light mode the accent is a dark brown, so the correct
  // foreground inverts — which is why --on-accent exists as its own token.
  for (const theme of THEMES) {
    it(`${theme}: --on-accent on --accent clears AA`, () => {
      const ratio = contrast(token("--on-accent", theme), token("--accent", theme));
      expect(ratio, `${theme} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  }
});

describe("token hygiene", () => {
  it("every surface and ink resolves to a literal hex colour", () => {
    for (const theme of THEMES) {
      for (const name of [...FOREGROUNDS, ...SURFACES, "--on-accent"]) {
        expect(token(name, theme), `${theme} ${name}`).toMatch(/^#[0-9a-f]{3,6}$/i);
      }
    }
  });
});
