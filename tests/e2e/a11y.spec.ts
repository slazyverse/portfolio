import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Baseline accessibility guarantees.
 *
 * These are the properties the site already had and must not lose as SUBSTRATE
 * is built on top of it. Every assertion here corresponds to something the
 * Phase 0 audit verified by hand; automating them means the next nine phases
 * cannot quietly undo any of it.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function audit(
  page: import("@playwright/test").Page,
  path: string,
  disable: string[] = [],
) {
  await page.goto(path);
  let builder = new AxeBuilder({ page }).withTags(WCAG);
  for (const rule of disable) builder = builder.disableRules(rule);
  const results = await builder.analyze();
  return results.violations.map(
    (v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.help}`,
  );
}

/**
 * Contrast is audited with motion OFF, and that is the correct state to audit.
 *
 * Reveals are additive: content is present in the markup and JavaScript only
 * hides it — `[data-reveal-armed]`, opacity 0 — once it has confirmed it can
 * bring it back on scroll. A freshly loaded page therefore holds ~80 elements
 * at opacity 0 below the fold, in a state no reader ever sees. axe scores them
 * inconsistently: sometimes skipped as invisible, sometimes sampled
 * mid-transition and reported as a contrast failure. Auditing that state makes
 * the suite pass or fail on timing rather than on the page.
 *
 * Under reduced motion the site guarantees its resting state — nothing armed,
 * everything at its final colour — which is exactly the state a contrast audit
 * is about. The transitional colours are not a state anyone reads.
 *
 * Contrast is additionally proven at the token level: tests/contrast.test.ts
 * checks all 72 ink-on-surface pairings straight out of the stylesheet, which
 * is the primary guarantee. This is the render-time confirmation of it.
 */
test.describe("axe — settled state", () => {
  test.use({ reducedMotion: "reduce" });

  for (const [name, path] of [
    ["home page", "/"],
    // The laboratory exercises every primitive at once, so it is the cheapest
    // place to catch one that is inaccessible in isolation.
    ["system reference", "/system"],
    ["404 page", "/this-route-does-not-exist"],
  ] as const) {
    test(`${name} has no WCAG A/AA violations`, async ({ page }) => {
      const violations = await audit(page, path);
      expect(violations, violations.join("\n")).toEqual([]);
    });
  }
});

/**
 * With motion ON, everything except contrast still has to hold: roles, names,
 * labels, landmarks and structure do not depend on whether a reveal has fired.
 * `color-contrast` is disabled here because it is the one rule whose result is
 * a function of transition timing, and it is fully covered above.
 */
test.describe("axe — motion on", () => {
  for (const [name, path] of [
    ["home page", "/"],
    ["system reference", "/system"],
  ] as const) {
    test(`${name} has no non-contrast violations`, async ({ page }) => {
      const violations = await audit(page, path, ["color-contrast"]);
      expect(violations, violations.join("\n")).toEqual([]);
    });
  }
});

test.describe("structure", () => {
  test("exactly one h1, and heading levels never skip", async ({ page }) => {
    await page.goto("/");
    const levels = await page.$$eval("main :is(h1,h2,h3,h4,h5,h6)", (els) =>
      els.map((e) => Number(e.tagName[1])),
    );
    expect(levels.filter((l) => l === 1)).toHaveLength(1);
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i]! - levels[i - 1]!, `skip at index ${i}: ${levels.join(",")}`).toBeLessThanOrEqual(1);
    }
  });

  test("landmarks are present", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main")).toHaveCount(1);
    await expect(page.locator("header")).toHaveCount(1);
    await expect(page.locator("footer")).toHaveCount(1);
    await expect(page.locator('nav[aria-label="Section navigation"]')).toHaveCount(1);
  });

  test("every aria-labelledby resolves to a real element", async ({ page }) => {
    await page.goto("/");
    const broken = await page.$$eval("[aria-labelledby]", (els) =>
      els
        .filter((e) => !document.getElementById(e.getAttribute("aria-labelledby")!))
        .map((e) => e.id || e.tagName),
    );
    expect(broken).toEqual([]);
  });
});

test.describe("keyboard", () => {
  test("the skip link is the first focusable element and reaches main", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.locator("a.skip");
    await expect(skip).toBeFocused();
    await expect(skip).toHaveAttribute("href", "#main");
  });

  test("interactive targets are at least 24x24 (WCAG 2.2 SC 2.5.8)", async ({ page }) => {
    await page.goto("/");
    const small = await page.$$eval("a, button", (els) =>
      els
        .map((e) => {
          const r = e.getBoundingClientRect();
          return { label: (e.textContent || "").trim().slice(0, 30), w: r.width, h: r.height };
        })
        .filter((x) => x.h > 0 && (x.h < 24 || x.w < 24)),
    );
    expect(small).toEqual([]);
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("renders its resting state: nothing armed, no tall scroll tracks", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(600);

    // Nothing may be left hidden behind a transition that will never run.
    await expect(page.locator("[data-reveal-armed]")).toHaveCount(0);
    await expect(page.locator("[data-line-armed]")).toHaveCount(0);

    // Only the scroll TRACKS must collapse. A substring match on "vh]" would
    // also catch the hero section's legitimate min-h-[88vh], so this parses the
    // utility class and keeps only genuine three-digit track heights.
    const tracks = await page.$$eval("[class]", (els) =>
      els
        .map((e) => (typeof e.className === "string" ? e.className : ""))
        .filter((c) =>
          c
            .split(" ")
            .some(
              (t) =>
                t.startsWith("h-[") &&
                t.endsWith("vh]") &&
                Number(t.slice(3, -3)) > 100,
            ),
        ),
    );
    expect(tracks, "tall tracks still present: " + tracks.join(" | ")).toEqual([]);

    // Nothing may be left sticky either; a pinned figure with no track is a
    // figure stuck to the top of the screen.
    const sticky = await page.$$eval("figure", (els) =>
      els.filter((e) => getComputedStyle(e).position === "sticky").length,
    );
    expect(sticky).toBe(0);
  });

  test("the descent falls back to readable stacked HTML", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(400);
    await expect(page.locator(".descent-frame pre code").first()).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(1); // the 2D graph only; no WebGL canvas
  });
});

test.describe("content is never trapped in pixels", () => {
  test("the allocation graph exposes its state as text", async ({ page }) => {
    await page.goto("/");
    const canvas = page.locator('canvas[role="img"]');
    await expect(canvas).toHaveAttribute("aria-label", /allocation graph/i);
  });

  test("the descent story is available to assistive technology", async ({ page }) => {
    await page.goto("/");
    const items = page.locator("ol.sr-only li");
    await expect(items).toHaveCount(4);
  });
});
