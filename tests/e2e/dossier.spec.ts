import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { CONTRACTS } from "../../src/data/contracts";
import { dossierSections } from "../../src/lib/contract";

/**
 * The dossier, as a browser sees it.
 *
 * The record is proven hermetically in `tests/dossier.test.ts` — readiness
 * against content, decisions in four parts, numbering, navigation, the
 * evidence count. This file is for the properties that only exist once the
 * page is rendered:
 *
 *  - that every section the in-page index promises is actually on the page
 *  - that the fragments work, which is the whole reason they exist
 *  - that a reader can move between projects without going back to the index
 *  - that the same story survives at phone width, with nothing hidden
 *  - that eleven sections of dense technical content stay accessible
 *
 * Data-driven from the contract records rather than hard-coded, so adding a
 * project or filling in a section extends the suite instead of quietly
 * escaping it.
 */

test.describe.configure({ mode: "serial" });

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.describe("the work index", () => {
  test("names every project and what kind of engineering it is", async ({ page }) => {
    await page.goto("/contracts");

    for (const contract of CONTRACTS) {
      await expect(
        page.getByRole("heading", { name: contract.name, exact: true }),
      ).toBeVisible();
      await expect(page.getByText(contract.domain, { exact: true }).first()).toBeVisible();
    }
  });

  test("states ownership on the index, not only inside each project", async ({ page }) => {
    await page.goto("/contracts");
    // Whose work a thing is should be learnable without opening it. On a team
    // project this is the sentence that matters most.
    for (const contract of CONTRACTS) {
      await expect(
        page.getByText(contract.attribution.summary, { exact: false }),
      ).toBeVisible();
    }
  });

  test("opens a dossier from the index", async ({ page }) => {
    await page.goto("/contracts");
    await page.getByRole("heading", { name: "deadlockd", exact: true }).getByRole("link").click();
    await page.waitForURL("**/contracts/deadlockd");
    await expect(page.locator("main h1")).toContainText("deadlockd");
  });
});

for (const contract of CONTRACTS) {
  const sections = dossierSections(contract);

  test.describe(`${contract.name} dossier`, () => {
    test("renders every section its own index promises", async ({ page }) => {
      await page.goto(`/contracts/${contract.slug}`);

      const listed = await page
        .locator('nav[aria-label="Sections of this dossier"] a')
        .evaluateAll((links) =>
          links.map((l) => (l.getAttribute("href") ?? "").replace("#", "")),
        );

      expect(listed).toEqual(sections.map((s) => s.anchor));

      // Promised is not rendered. Every anchor has to resolve to a real
      // region, or the index is a list of broken links.
      for (const anchor of listed) {
        await expect(
          page.locator(`section#${anchor}`),
          `${contract.slug} lists #${anchor} but has no such section`,
        ).toHaveCount(1);
      }
    });

    test("keeps one h1 and no skipped heading levels", async ({ page }) => {
      await page.goto(`/contracts/${contract.slug}`);

      await expect(page.locator("main h1")).toHaveCount(1);

      const levels = await page
        .locator("main h1, main h2, main h3, main h4")
        .evaluateAll((hs) => hs.map((h) => Number(h.tagName.slice(1))));

      expect(levels[0]).toBe(1);
      for (let i = 1; i < levels.length; i += 1) {
        expect(
          levels[i]! - levels[i - 1]!,
          `${contract.slug}: h${levels[i - 1]} is followed by h${levels[i]}`,
        ).toBeLessThanOrEqual(1);
      }
    });

    test("gives every sourced statement a real link off the page", async ({ page }) => {
      await page.goto(`/contracts/${contract.slug}`);

      const chips = page.locator("a.verify");
      const count = await chips.count();
      expect(count, `${contract.slug} shows no evidence at all`).toBeGreaterThan(4);

      for (let i = 0; i < count; i += 1) {
        const chip = chips.nth(i);
        await expect(chip).toHaveAttribute("href", /^https:\/\//);
        // New tab without a warning is disorienting, and `noopener` is not
        // optional on a target we do not control.
        await expect(chip).toHaveAttribute("rel", /noopener/);
      }
    });

    test("scrolls to a section when the fragment is used", async ({ page }) => {
      const anchor = sections[sections.length - 1]!.anchor;
      await page.goto(`/contracts/${contract.slug}#${anchor}`);

      const top = await page
        .locator(`section#${anchor}`)
        .evaluate((el) => el.getBoundingClientRect().top);

      // Inside the viewport and clear of the fixed status bar, which is what
      // the scroll margin on the section is for.
      expect(top).toBeGreaterThanOrEqual(0);
      expect(top).toBeLessThan(400);
    });

    test("lays out at phone width with nothing spilling sideways", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(`/contracts/${contract.slug}`);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${contract.slug} overflows by ${overflow}px`).toBeLessThanOrEqual(0);

      // And the depth is still there. A phone layout that drops the evidence
      // is a different page, not a smaller one.
      for (const section of sections) {
        await expect(
          page.locator(`section#${section.anchor}`),
          `${section.anchor} is missing on mobile`,
        ).toHaveCount(1);
      }
      expect(await page.locator("a.verify").count()).toBeGreaterThan(4);
    });
  });
}

test.describe("moving through the work", () => {
  test("offers the next project at the end of one, and does not wrap", async ({ page }) => {
    const first = CONTRACTS[0]!;
    const last = CONTRACTS[CONTRACTS.length - 1]!;

    await page.goto(`/contracts/${first.slug}`);
    const nav = page.getByRole("navigation", { name: "More projects" });
    await expect(nav).toContainText("This is the first contract.");
    await nav.getByRole("link", { name: CONTRACTS[1]!.name, exact: false }).click();
    await page.waitForURL(`**/contracts/${CONTRACTS[1]!.slug}`);

    await page.goto(`/contracts/${last.slug}`);
    await expect(
      page.getByRole("navigation", { name: "More projects" }),
    ).toContainText("This is the last contract.");
  });

  test("sends a reader to this project's evidence, not the top of the index", async ({
    page,
  }) => {
    await page.goto("/contracts/apix");
    await page
      .getByRole("navigation", { name: "More projects" })
      .getByRole("link", { name: /Evidence for APIx/i })
      .click();
    await page.waitForURL("**/verify**");

    // The heading the fragment names has to exist, or the link lands nowhere
    // in particular and looks like it worked.
    await expect(page.locator("#ev-apix")).toHaveCount(1);
  });

  test("keeps the canonical URL of every dossier", async ({ page }) => {
    for (const contract of CONTRACTS) {
      await page.goto(`/contracts/${contract.slug}`);
      const canonical = await page
        .locator('link[rel="canonical"]')
        .getAttribute("href");
      expect(canonical, contract.slug).toContain(`/contracts/${contract.slug}`);
    }
  });
});

test.describe("a dossier is readable by everyone", () => {
  test("adds no accessibility violations to the deepest project page", async ({ page }) => {
    test.setTimeout(90_000);
    // APIx is the longest: eleven sections, five decisions, seventeen sourced
    // statements. If the template has a problem, it is on this page.
    await page.goto("/contracts/apix");
    await page.waitForTimeout(1200);

    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    const violations = results.violations.map(
      (v) => `${v.id} (${v.impact}) x${v.nodes.length}`,
    );
    expect(violations, violations.join("\n")).toEqual([]);
  });

  test("adds no accessibility violations to the work index", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/contracts");
    await page.waitForTimeout(1200);

    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    const violations = results.violations.map(
      (v) => `${v.id} (${v.impact}) x${v.nodes.length}`,
    );
    expect(violations, violations.join("\n")).toEqual([]);
  });

  test("reaches every section of a dossier by keyboard", async ({ page }) => {
    await page.goto("/contracts/deadlockd");

    // The section index is a list of real links, so it is reachable and
    // operable without a pointer. Tab until one of them has focus rather than
    // assuming a tab count, which would encode the chrome's structure.
    let landed = false;
    for (let i = 0; i < 40 && !landed; i += 1) {
      await page.keyboard.press("Tab");
      landed = await page.evaluate(
        () =>
          document.activeElement?.closest('nav[aria-label="Sections of this dossier"]') !==
          null,
      );
    }
    expect(landed, "the dossier section index is not keyboard reachable").toBe(true);

    const href = await page.evaluate(() =>
      document.activeElement?.getAttribute("href"),
    );
    expect(href).toMatch(/^#/);
  });
});
