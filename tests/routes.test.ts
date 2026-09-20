import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTRACTS,
  CONTRACT_SLUGS,
  contractBySlug,
} from "@/data/contracts";
import {
  INDEXABLE_ROUTES,
  LEVEL_ORDER,
  NAV_ROUTES,
  ROUTES,
  contractPath,
  levelIndex,
  route,
} from "@/data/routes";
import { collectEvidence } from "@/lib/evidence";
import type { RouteId } from "@/data/types";

/**
 * Route and content integrity.
 *
 * These assert the invariants that hold the information architecture together:
 * that every declared route is actually implemented, that every contract
 * resolves, that every claim carries usable evidence, and that collaborative
 * work is never presented as sole work.
 *
 * The last one matters most. A team project silently losing its attribution is
 * not a rendering bug — it is the site telling a lie about someone else's work,
 * and it is exactly the kind of thing that happens quietly during a refactor.
 */

const EXPECTED_ROUTES: RouteId[] = [
  "signal",
  "dossier",
  "systems",
  "contracts",
  "contract",
  "record",
  "colophon",
  "verify",
  "contact",
  "cv",
  "system-reference",
];

describe("route table", () => {
  it("declares every expected route", () => {
    for (const id of EXPECTED_ROUTES) {
      expect(() => route(id), id).not.toThrow();
    }
  });

  it("has unique ids and unique paths per id", () => {
    const ids = ROUTES.map((r) => r.id);
    expect(ids).toEqual([...new Set(ids)]);
  });

  it("gives every route a level that exists, and a valid depth index", () => {
    for (const r of ROUTES) {
      expect(LEVEL_ORDER, `${r.id} has an unknown level`).toContain(r.level);
      expect(levelIndex(r.level)).toMatch(/^0[0-3]$/);
    }
  });

  it("carries both registers on every route", () => {
    // Dual register is a permanent rule: the in-world name is atmosphere, and
    // the conventional name is how anyone actually finds the page.
    for (const r of ROUTES) {
      expect(r.display.trim().length, `${r.id} display`).toBeGreaterThan(0);
      expect(r.conventional.trim().length, `${r.id} conventional`).toBeGreaterThan(0);
      expect(r.display, `${r.id} registers are identical`).not.toBe(r.conventional);
    }
  });

  it("gives every route metadata a title and a description", () => {
    for (const r of ROUTES) {
      expect(r.title.trim().length, `${r.id} title`).toBeGreaterThan(0);
      expect(r.description.trim().length, `${r.id} description`).toBeGreaterThan(20);
    }
  });

  it("only advertises routes that are actually available", () => {
    for (const r of NAV_ROUTES) expect(r.available, `${r.id} is in nav`).toBe(true);
    for (const r of INDEXABLE_ROUTES) {
      expect(r.available, `${r.id} is indexable`).toBe(true);
    }
  });

  it("keeps the design-system laboratory and the absent CV out of the index", () => {
    const indexed = INDEXABLE_ROUTES.map((r) => r.id);
    expect(indexed).not.toContain("system-reference");
    expect(indexed).not.toContain("cv");
    // The dynamic template is not a page in its own right.
    expect(indexed).not.toContain("contract");
  });

  it("has a page file for every navigable route", () => {
    // Catches a route declared in the table but never implemented — which
    // would otherwise only surface as a 404 in production.
    for (const r of NAV_ROUTES) {
      const dir = r.path === "/" ? "src/app" : `src/app${r.path}`;
      const file = join(process.cwd(), dir, "page.tsx");
      expect(existsSync(file), `${r.id} declares ${r.path} but ${dir}/page.tsx is missing`).toBe(true);
    }
  });
});

describe("contracts", () => {
  it("has unique, url-safe slugs", () => {
    expect(CONTRACT_SLUGS).toEqual([...new Set(CONTRACT_SLUGS)]);
    for (const slug of CONTRACT_SLUGS) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("has unique designations", () => {
    const designations = CONTRACTS.map((c) => c.designation);
    expect(designations).toEqual([...new Set(designations)]);
  });

  it("resolves every slug, and rejects unknown ones", () => {
    for (const slug of CONTRACT_SLUGS) {
      expect(contractBySlug(slug), slug).toBeDefined();
    }
    expect(contractBySlug("nonexistent")).toBeUndefined();
    expect(contractBySlug("")).toBeUndefined();
  });

  it("builds a canonical path for every contract", () => {
    for (const c of CONTRACTS) {
      expect(contractPath(c.slug)).toBe(`/contracts/${c.slug}`);
    }
  });

  it("places every contract at a real level", () => {
    for (const c of CONTRACTS) {
      expect(LEVEL_ORDER, `${c.slug} level`).toContain(c.level);
    }
  });

  it("carries the identification a reader needs", () => {
    for (const c of CONTRACTS) {
      expect(c.name.trim().length, c.slug).toBeGreaterThan(0);
      expect(c.tagline.trim().length, c.slug).toBeGreaterThan(20);
      expect(c.repoUrl, c.slug).toMatch(/^https:\/\/github\.com\//);
      expect(c.summary.length, c.slug).toBeGreaterThan(0);
      expect(c.metrics.length, c.slug).toBeGreaterThan(0);
      if (c.state === "live") expect(c.liveUrl, c.slug).toMatch(/^https:\/\//);
    }
  });

  it("records readiness honestly rather than leaving sections undeclared", () => {
    for (const c of CONTRACTS) {
      const states = Object.values(c.readiness);
      expect(states.length, `${c.slug} declares no readiness`).toBeGreaterThan(0);
      for (const s of states) {
        expect(
          ["verified", "needs-source", "needs-writing", "not-available"],
          `${c.slug} has an unknown readiness state`,
        ).toContain(s);
      }
    }
  });
});

describe("provenance", () => {
  it("gives every claim a usable source", () => {
    for (const c of CONTRACTS) {
      for (const claim of c.claims) {
        expect(claim.statement.trim().length, c.slug).toBeGreaterThan(10);
        expect(claim.source.href, `${c.slug}: ${claim.statement.slice(0, 30)}`).toMatch(
          /^https:\/\//,
        );
        expect(claim.source.path.trim().length, c.slug).toBeGreaterThan(0);
        expect(claim.source.href).not.toMatch(/example\.com|TODO|FIXME|localhost/i);
      }
    }
  });

  it("requires a source on every decision", () => {
    // The type already enforces this; the test catches a future `as any`.
    for (const c of CONTRACTS) {
      for (const d of c.decisions ?? []) {
        expect(d.source?.href, `${c.slug}: ${d.choice}`).toMatch(/^https:\/\//);
        expect(d.rejected.trim().length, "a decision must name what was rejected").toBeGreaterThan(0);
      }
    }
  });

  it("keeps the displayed path consistent with the link it opens", () => {
    for (const c of CONTRACTS) {
      for (const claim of c.claims) {
        const file = claim.source.path.split("/").filter(Boolean).pop();
        if (!file) continue;
        expect(
          claim.source.href,
          `${c.slug}: label says ${claim.source.path} but the link does not contain it`,
        ).toContain(file);
      }
    }
  });
});

describe("attribution", () => {
  it("declares an ownership model and a summary for every contract", () => {
    for (const c of CONTRACTS) {
      expect(["sole", "team"], c.slug).toContain(c.attribution.model);
      expect(c.attribution.summary.trim().length, c.slug).toBeGreaterThan(10);
      expect(c.attribution.entries.length, c.slug).toBeGreaterThan(0);
    }
  });

  it("never presents collaborative work as sole work", () => {
    // The invariant that protects other people's credit.
    for (const c of CONTRACTS) {
      if (c.attribution.model !== "team") continue;

      const hasOthers = c.attribution.entries.some((e) => !e.mine);
      expect(hasOthers, `${c.slug} is a team project but claims every layer`).toBe(true);

      expect(
        c.attribution.notClaimed?.trim().length ?? 0,
        `${c.slug} is a team project and must state what is not claimed`,
      ).toBeGreaterThan(10);
    }
  });

  it("names a contributor and a size for every attribution row", () => {
    for (const c of CONTRACTS) {
      for (const e of c.attribution.entries) {
        expect(e.area.trim().length, c.slug).toBeGreaterThan(0);
        expect(e.who.trim().length, c.slug).toBeGreaterThan(0);
        expect(e.size.trim().length, `${c.slug}: ${e.area}`).toBeGreaterThan(0);
      }
    }
  });

  it("credits named collaborators on team projects", () => {
    for (const c of CONTRACTS) {
      if (c.attribution.model !== "team") continue;
      for (const person of c.attribution.collaborators ?? []) {
        expect(person.name.trim().length, c.slug).toBeGreaterThan(0);
        if (person.href) expect(person.href).toMatch(/^https:\/\//);
      }
    }
  });
});

describe("APIx is represented exactly as the evidence supports", () => {
  const apix = contractBySlug("apix");

  it("exists as a contract", () => {
    expect(apix).toBeDefined();
  });

  it("is a team project that does not claim the whole repository", () => {
    expect(apix!.attribution.model).toBe("team");
    expect(apix!.attribution.entries.filter((e) => !e.mine).length).toBeGreaterThan(0);
    expect(apix!.attribution.notClaimed).toBeTruthy();
  });

  it("does not assert the unverified Smart India Hackathon association", () => {
    // The only trace of it is a teammate's local directory path in two
    // committed files. Suggestive, not probative — so it is not a public fact
    // until it can carry a source like every other claim here.
    const text = JSON.stringify(apix).toLowerCase();
    expect(text).not.toMatch(/smart india hackathon/);
    expect(text).not.toMatch(/\bsih\b/);
  });

  it("does not quote the inflated raw line count", () => {
    // 22,878 of the raw 50,935 additions are thirteen generated JSON
    // artifacts. Quoting the total would overstate the contribution by half.
    const text = JSON.stringify(apix);
    expect(text).not.toContain("50,935");
    expect(text).not.toContain("50935");
  });
});

describe("evidence index", () => {
  const entries = collectEvidence();

  it("collects something for every contract", () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const c of CONTRACTS) {
      expect(
        entries.some((e) => e.context === c.name),
        `${c.name} contributes nothing to /verify`,
      ).toBe(true);
    }
  });

  it("gives every entry a source and a place it appears", () => {
    for (const e of entries) {
      expect(e.source.href, e.id).toMatch(/^https:\/\//);
      expect(e.href, e.id).toMatch(/^\//);
      expect(e.statement.trim().length, e.id).toBeGreaterThan(5);
    }
  });

  it("uses stable, unique ids", () => {
    const ids = entries.map((e) => e.id);
    expect(ids).toEqual([...new Set(ids)]);
  });

  it("shows only sources that exist in the underlying data", () => {
    // Guards against /verify inventing or mutating an entry: every href it
    // displays must be present in a contract or principle record.
    const known = new Set<string>();
    for (const c of CONTRACTS) {
      for (const claim of c.claims) known.add(claim.source.href);
      for (const r of c.result ?? []) known.add(r.source.href);
      for (const d of c.decisions ?? []) known.add(d.source.href);
      for (const a of c.attribution.entries) if (a.source) known.add(a.source.href);
    }
    for (const e of entries) {
      if (e.kind === "principle") continue;
      expect(known, `/verify shows a source no contract declares: ${e.source.href}`).toContain(
        e.source.href,
      );
    }
  });
});
