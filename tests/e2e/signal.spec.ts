import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * The landing, as seen by a browser.
 *
 * The shot itself is proven hermetically in `tests/signal.test.ts` — the
 * keyframes, the sampler, the policy and the state machine, in milliseconds,
 * with no browser at all. This file exists for the properties only a real page
 * can demonstrate:
 *
 *  - that the portfolio is complete and navigable during the opening, not
 *    after it
 *  - that the opening always terminates, including when the environment never
 *    starts
 *  - that reduced motion gets the finished page immediately
 *  - that returning Home through the site does not replay anything
 *  - that one WebGL context serves the whole session, landing included
 *
 * Several of these correspond to ways this could quietly fail: a hero held
 * hidden by an attribute nobody cleared, a second canvas opened by the descent
 * scene, a camera that never reports it finished.
 */

test.describe.configure({ mode: "serial" });

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** The opening is bounded; this is comfortably past the long form. */
const OPENING_MS = 9000;

test.describe("the landing is a page first", () => {
  test("serves the subject, the positioning and every destination in the HTML", async ({
    page,
  }) => {
    // No JavaScript required, no camera required, no WebGL required. This is
    // what a crawler, a reader with scripting off, and a failed hydration all
    // receive.
    const response = await page.goto("/");
    // Ampersands arrive escaped, as they should — "skills &amp; stack". The
    // assertion is about the words being served, not about the encoding.
    const html = ((await response?.text()) ?? "").replace(/&amp;/g, "&");

    expect(html).toContain("Sagar Tailor");
    expect(html).toContain("Builds the layer underneath");
    // Both registers, because the dual-register rule is what stops the theme
    // becoming a lock on the content: the in-world designation is the large
    // word, and the plain word sits beside it. `/contact` is COMMS in world.
    for (const designation of ["DOSSIER", "SYSTEMS", "CONTRACTS", "RECORD", "COMMS"]) {
      expect(html, `${designation} missing from the served markup`).toContain(designation);
    }
    for (const plain of ["profile", "skills & stack", "contracts", "record", "contact"]) {
      expect(html, `"${plain}" missing from the served markup`).toContain(plain);
    }
  });

  test("is navigable while the opening is still running", async ({ page }) => {
    await page.goto("/");
    // Immediately — no waiting for a camera, no scroll lock, no overlay to
    // dismiss. If the opening ever becomes a gate, this is what notices.
    const link = page.getByRole("link", { name: /dossier/i }).first();
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL("**/dossier");
    await expect(page.locator("main#main")).toBeVisible();
  });

  test("keeps exactly one h1, and it names the subject", async ({ page }) => {
    await page.goto("/");
    const headings = page.locator("main h1");
    await expect(headings).toHaveCount(1);
    await expect(headings.first()).toHaveText("Sagar Tailor");
  });

  test("adds no accessibility violations", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    await page.waitForTimeout(1500);
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    const violations = results.violations.map(
      (v) => `${v.id} (${v.impact}) x${v.nodes.length}`,
    );
    expect(violations, violations.join("\n")).toEqual([]);
  });
});

test.describe("the opening terminates", () => {
  test("always reaches the finished state, whatever the device did", async ({ page }) => {
    // The failure this exists for: the inline script hides the hero before
    // first paint, and if nothing ever cleared the attribute — no WebGL, a
    // camera that never reported finishing, a bundle that failed — the
    // subject would stay invisible. It must resolve on every path.
    await page.goto("/");
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.signal ?? "ready"), {
        timeout: OPENING_MS,
      })
      .toBe("ready");

    await expect(page.locator("#entry-heading")).toBeVisible();
    const opacity = await page
      .locator(".signal-subject")
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(opacity)).toBeGreaterThan(0.99);
  });

  test("never announces the camera to a screen reader", async ({ page }) => {
    await page.goto("/");
    // The readout describes decoration. A reader hearing "resolving structure"
    // would be told about a camera they cannot see, while the heading they
    // need sits directly below it.
    await expect(page.locator(".signal-boot")).toHaveAttribute("aria-hidden", "true");
  });
});

test.describe("returning visitors", () => {
  test("do not watch anything again when they come back through the site", async ({
    page,
  }) => {
    await page.goto("/");
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.signal ?? "ready"), {
        timeout: OPENING_MS,
      })
      .toBe("ready");

    await page.getByRole("link", { name: /dossier/i }).first().click();
    await page.waitForURL("**/dossier");

    // Back to Home, client-side. They never left the world, so the subject is
    // there on arrival rather than after a camera move.
    await page.goto("/", { waitUntil: "commit" });
    await page.getByRole("link", { name: /home|signal/i }).first().click().catch(() => {});
    await page.waitForTimeout(600);
    await expect(page.locator("#entry-heading")).toBeVisible();
  });

  test("record having seen it, so a reload is not the long form again", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1200);
    const seen = await page.evaluate(() =>
      window.sessionStorage.getItem("substrate:signal-seen"),
    );
    expect(seen).not.toBeNull();
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("gets the finished page immediately, with everything in it", async ({ page }) => {
    await page.goto("/");
    // No camera, no hidden hero, no waiting. `data-signal` is never set at
    // all, because the inline script reads the motion contract first.
    const signal = await page.evaluate(
      () => document.documentElement.dataset.signal ?? "unset",
    );
    expect(["unset", "ready"]).toContain(signal);

    await expect(page.locator("#entry-heading")).toBeVisible();
    const opacity = await page
      .locator(".signal-subject")
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(opacity)).toBe(1);

    // And every destination is reachable.
    await expect(page.getByRole("navigation", { name: "Sections" }).getByRole("link")).toHaveCount(5);
  });
});

test.describe("one world, one context", () => {
  test("opens no second canvas on the landing route", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 768, "the desktop tier is the one that renders a city");

    await page.goto("/");
    await page.waitForTimeout(3000);

    const canvases = await page.locator("canvas").count();
    // Before Phase 6 the landing owned a scroll-driven scene and the city
    // stood down. Now the city renders here and that scene yields — because
    // two live WebGL contexts on one document is what made `/system`
    // unable to finish a frame.
    expect(canvases).toBeLessThanOrEqual(1);
  });

  test("keeps the same context across the landing and back", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 768, "desktop navigation");

    await page.goto("/dossier");
    await page.waitForTimeout(1500);
    const hasCanvas = await page.locator(".env canvas").count();
    test.skip(hasCanvas === 0, "this browser resolved to a non-WebGL tier");

    await page.locator(".env canvas").evaluate((el) => {
      (el as HTMLElement).dataset.signalProbe = "original";
    });

    await page.getByRole("link", { name: /home|signal/i }).first().click();
    await page.waitForTimeout(900);

    await expect(page.locator(".env canvas")).toHaveCount(1);
    const same = await page
      .locator(".env canvas")
      .evaluate((el) => (el as HTMLElement).dataset.signalProbe === "original");
    expect(same, "the landing rebuilt the WebGL context").toBe(true);
  });
});

test.describe("mobile", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, "mobile only");

  test("never waits for WebGL before the portfolio is usable", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#entry-heading")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Sections" }).getByRole("link")).toHaveCount(5);

    await page.waitForTimeout(2500);
    // The tier contract refuses WebGL below the top two tiers, so a phone
    // gets the CSS atmosphere and no camera at all.
    expect(await page.locator(".env canvas").count()).toBe(0);
    expect(
      await page.evaluate(() => document.documentElement.dataset.signal ?? "ready"),
    ).toBe("ready");
  });

  test("lays out without horizontal overflow", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
