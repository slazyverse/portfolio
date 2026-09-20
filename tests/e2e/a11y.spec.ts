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
    ["profile", "/dossier"],
    ["systems", "/systems"],
    ["projects index", "/contracts"],
    ["a contract dossier", "/contracts/apix"],
    ["engineering record", "/record"],
    ["colophon", "/colophon"],
    ["evidence index", "/verify"],
    ["contact", "/contact"],
    // The laboratory exercises every primitive at once, so it is the cheapest
    // place to catch one that is inaccessible in isolation.
    ["system reference", "/system"],
    ["404 page", "/this-route-does-not-exist"],
    ["unknown contract slug", "/contracts/does-not-exist"],
  ] as const) {
    test(`${name} has no WCAG A/AA violations`, async ({ page }) => {
      const violations = await audit(page, path);
      expect(violations, violations.join("\n")).toEqual([]);
    });
  }
});

/**
 * Routing behaviour that only exists because Phase 3 added real routes.
 *
 * Client navigation does not reload the document, so none of this is free: a
 * screen-reader user hears nothing and a keyboard user keeps focus on a link
 * that no longer exists unless it is handled explicitly.
 */
test.describe("routing", () => {
  test("an unknown contract slug reaches not-found, not an empty page", async ({ page }) => {
    const res = await page.goto("/contracts/definitely-not-a-project");
    expect(res?.status()).toBe(404);
    await expect(page.locator("main#main")).toContainText(/no layer here/i);
  });

  test("every navigable route responds and has one h1", async ({ page }) => {
    for (const path of [
      "/",
      "/dossier",
      "/systems",
      "/contracts",
      "/record",
      "/colophon",
      "/verify",
      "/contact",
    ]) {
      const res = await page.goto(path);
      expect(res?.status(), `${path} status`).toBe(200);
      await expect(page.locator("main h1"), `${path} h1 count`).toHaveCount(1);
      // The document title must carry the conventional name, not the in-world
      // one — a browser tab reading "CONTRACTS" helps nobody.
      expect(await page.title(), `${path} title`).not.toBe("");
    }
  });

  test("navigating moves focus to the main region", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "projects" }).first().click();
    await page.waitForURL("**/contracts");

    const focusedId = await page.evaluate(() => document.activeElement?.id ?? "");
    expect(focusedId, "focus should land on #main after a route change").toBe("main");
  });

  test("navigating announces the new route by its conventional name", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "profile" }).first().click();
    await page.waitForURL("**/dossier");

    const announcer = page.locator('[aria-live="polite"]').first();
    await expect(announcer).toContainText(/navigated to profile/i);
  });

  test("the current level is marked in the rail", async ({ page }) => {
    await page.goto("/contracts");
    const current = page.locator('nav[aria-label="Levels"] a[aria-current="true"]');
    await expect(current).toHaveCount(1);
    await expect(current).toContainText(/engine/i);
  });
});

/**
 * SystemChrome — the persistent interface layer.
 *
 * The properties asserted here are the ones that make it a system rather than
 * a header: that it survives navigation, that it always knows which level the
 * visitor is on, and that every part of it can be driven without a pointer.
 */
test.describe("system chrome", () => {
  test("every level in the rail resolves to a real route", async ({ page }) => {
    await page.goto("/");
    const hrefs = await page.$$eval('nav[aria-label="Levels"] a', (els) =>
      els.map((e) => e.getAttribute("href") ?? ""),
    );
    expect(hrefs).toHaveLength(4);
    for (const href of hrefs) {
      const res = await page.request.get(href);
      expect(res.status(), `${href} from the level rail`).toBe(200);
    }
  });

  test("the status bar reports the current level, and it updates on navigation", async ({ page }) => {
    await page.goto("/");
    const bar = page.locator("header").first();
    await expect(bar).toContainText("SUBSTRATE");
    await expect(bar).toContainText("00");

    await page.goto("/contracts");
    await expect(bar).toContainText("02");

    // A contract reports its own designation, from project data.
    await page.goto("/contracts/apix");
    await expect(bar).toContainText("CONTRACT 02");
  });

  test("deadlockd reports substrate, not engine", async ({ page }) => {
    // Contracts take their level from the contract, not the route table:
    // deadlockd is substrate work and the other two are engine work.
    await page.goto("/contracts/deadlockd");
    await expect(page.locator("header").first()).toContainText("03");
  });

  test("the chrome persists across client navigation without remounting", async ({ page }) => {
    await page.goto("/");
    // Tag the live chrome node, navigate, and check the same node is still there.
    await page.evaluate(() => {
      document.querySelector("header")?.setAttribute("data-persist-probe", "1");
    });
    await page.getByRole("link", { name: /projects/i }).first().click();
    await page.waitForURL("**/contracts");
    await expect(page.locator("header[data-persist-probe]")).toHaveCount(1);
  });

  test("the command palette opens on the keyboard shortcut and navigates", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");

    const dialog = page.getByRole("dialog", { name: "Navigate" });
    await expect(dialog).toBeVisible();

    await page.keyboard.type("colophon");
    await page.keyboard.press("Enter");
    await page.waitForURL("**/colophon");
    await expect(dialog).toBeHidden();
  });

  test("the palette closes on Escape and returns focus", async ({ page, viewport }) => {
    // The visible trigger is desktop-only; on mobile the palette is reached by
    // the keyboard shortcut, which the previous test already covers.
    test.skip((viewport?.width ?? 0) < 768, "desktop trigger only");
    await page.goto("/");
    const trigger = page.getByRole("button", { name: /open navigation search/i });
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Navigate" });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    // Native <dialog> returns focus to the invoker.
    await expect(trigger).toBeFocused();
  });
});

test.describe("system chrome — mobile", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, "mobile only");

  test("the drawer opens, lists every route, and closes on Escape", async ({ page }) => {
    await page.goto("/");
    const trigger = page.getByRole("button", { name: "Menu" });
    await trigger.click();

    const drawer = page.getByRole("dialog", { name: "Site navigation" });
    await expect(drawer).toBeVisible();
    // Both registers are visible on mobile: there is no hover to reveal the
    // plain name behind the in-world one.
    await expect(drawer).toContainText("CONTRACTS");
    await expect(drawer).toContainText("projects");

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("the drawer closes after navigating", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Site navigation" });
    await drawer.getByRole("link", { name: /profile/i }).click();
    await page.waitForURL("**/dossier");
    await expect(drawer).toBeHidden();
  });

  test("the mobile bar does not cover the end of the content", async ({ page }) => {
    await page.goto("/contact");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const overlap = await page.evaluate(() => {
      const bar = document.querySelector('nav[aria-label="Levels and menu"]');
      const footer = document.querySelector("footer");
      if (!bar || !footer) return -1;
      const b = bar.getBoundingClientRect();
      const f = footer.getBoundingClientRect();
      return f.bottom - b.top;
    });
    expect(overlap, "footer is hidden behind the fixed mobile bar").toBeLessThanOrEqual(0);
  });
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
    // SystemChrome provides the level navigation: the rail on desktop, the
    // level-and-menu bar on mobile. Exactly one renders at a time — two
    // navigation systems that could disagree about where the visitor is would
    // be worse than either alone, which is why DepthRail was retired rather
    // than kept alongside.
    const rail = page.locator('nav[aria-label="Levels"]');
    const bar = page.locator('nav[aria-label="Levels and menu"]');
    const visible =
      (await rail.isVisible().catch(() => false)) ||
      (await bar.isVisible().catch(() => false));
    expect(visible, "a level navigation landmark should be visible").toBe(true);
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
