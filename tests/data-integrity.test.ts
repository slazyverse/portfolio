import { describe, expect, it } from "vitest";
import { PROJECTS, VAYU_LAYERS } from "@/data/projects";
import { PRINCIPLES, RECORD, STACK } from "@/data/principles";
import { DESCENT } from "@/data/descent";
import { NAV, SITE, STRATA } from "@/data/site";

/**
 * The content model's invariants.
 *
 * The site's whole premise is that a claim cannot exist without the evidence
 * behind it. The type system enforces that a `Source` is present; these tests
 * enforce that the `Source` is actually usable — a well-formed permalink into a
 * real repository rather than a placeholder that satisfies the compiler.
 */

const allClaims = [
  ...PROJECTS.flatMap((p) => p.claims.map((c) => ({ ...c, owner: p.slug }))),
  ...PRINCIPLES.map((p) => ({ statement: p.title, source: p.source, owner: `principle-${p.index}` })),
];

describe("claims carry usable evidence", () => {
  it("finds every claim on the site", () => {
    expect(allClaims.length).toBeGreaterThan(0);
  });

  for (const claim of allClaims) {
    describe(`${claim.owner}: "${claim.statement.slice(0, 48)}…"`, () => {
      it("has a non-empty statement", () => {
        expect(claim.statement.trim().length).toBeGreaterThan(10);
      });

      it("has an https source href", () => {
        expect(claim.source.href).toMatch(/^https:\/\//);
      });

      it("points at a real repository path, not a placeholder", () => {
        expect(claim.source.href).toMatch(/github\.com\/[\w.-]+\/[\w.-]+\/blob\//);
        expect(claim.source.path.trim().length).toBeGreaterThan(0);
        expect(claim.source.href).not.toMatch(/example\.com|TODO|FIXME|localhost/i);
      });

      it("keeps the displayed path consistent with the href", () => {
        // The label a reader sees must be the file the link actually opens.
        const file = claim.source.path.split("/").pop()!;
        expect(claim.source.href).toContain(file);
      });
    });
  }
});

describe("code excerpts", () => {
  const excerpts = PROJECTS.flatMap((p) => (p.excerpt ? [{ ...p.excerpt, slug: p.slug }] : []));

  for (const ex of excerpts) {
    it(`${ex.slug}: every quoted line falls inside the declared range`, () => {
      // A line rendered outside the stated range is either mislabelled or, as
      // happened with banker.go line 32, not in the source file at all.
      const bounds = ex.range.match(/L(\d+)\s*[—–-]\s*L(\d+)/);
      expect(bounds, `unparseable range: ${ex.range}`).not.toBeNull();
      const [lo, hi] = [Number(bounds![1]), Number(bounds![2])];
      for (const line of ex.lines) {
        expect(line.n, `line ${line.n} is outside ${ex.range}`).toBeGreaterThanOrEqual(lo);
        expect(line.n, `line ${line.n} is outside ${ex.range}`).toBeLessThanOrEqual(hi);
      }
    });

    it(`${ex.slug}: line numbers ascend and never repeat`, () => {
      const ns = ex.lines.map((l) => l.n);
      expect(ns).toEqual([...new Set(ns)]);
      expect(ns).toEqual([...ns].sort((a, b) => a - b));
    });
  }
});

describe("navigation and strata", () => {
  it("every NAV entry names a stratum that exists", () => {
    const ids = new Set(STRATA.map((s) => s.id));
    for (const item of NAV) expect(ids, item.id).toContain(item.stratum);
  });

  it("NAV ids are unique", () => {
    const ids = NAV.map((n) => n.id);
    expect(ids).toEqual([...new Set(ids)]);
  });

  it("every project slug is reachable from NAV", () => {
    const ids = new Set(NAV.map((n) => n.id));
    for (const p of PROJECTS) expect(ids, `${p.slug} has no nav entry`).toContain(p.slug);
  });

  it("strata indices are sequential two-digit markers", () => {
    expect(STRATA.map((s) => s.index)).toEqual(["00", "01", "02", "03"]);
  });
});

describe("project records", () => {
  it("slugs are unique and url-safe", () => {
    const slugs = PROJECTS.map((p) => p.slug);
    expect(slugs).toEqual([...new Set(slugs)]);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  it("a live project declares where it is live", () => {
    for (const p of PROJECTS) {
      if (p.state === "live") expect(p.liveUrl, `${p.slug}`).toMatch(/^https:\/\//);
    }
  });

  it("states ownership explicitly", () => {
    for (const p of PROJECTS) expect(p.ownership.trim().length, p.slug).toBeGreaterThan(0);
  });

  it("every project has at least one claim and one metric", () => {
    for (const p of PROJECTS) {
      expect(p.claims.length, p.slug).toBeGreaterThan(0);
      expect(p.metrics.length, p.slug).toBeGreaterThan(0);
    }
  });
});

describe("attribution stays honest", () => {
  it("credits non-owned layers to a named contributor", () => {
    for (const layer of VAYU_LAYERS) {
      expect(layer.who.trim().length).toBeGreaterThan(0);
      expect(layer.size.trim().length).toBeGreaterThan(0);
    }
  });

  it("does not claim every layer", () => {
    // If this ever becomes all-true, the cross-section has stopped being an
    // attribution diagram and become a credit grab.
    expect(VAYU_LAYERS.some((l) => !l.mine)).toBe(true);
  });
});

describe("site identity", () => {
  it("has a contactable email and https profiles", () => {
    expect(SITE.email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
    expect(SITE.github).toMatch(/^https:\/\/github\.com\//);
    expect(SITE.linkedin).toMatch(/^https:\/\//);
  });

  it("keeps handles consistent with their urls", () => {
    expect(SITE.github).toContain(SITE.githubHandle.replace("github.com/", ""));
  });
});

describe("supporting content", () => {
  it("the descent has one layer per stratum, in order", () => {
    expect(DESCENT.map((d) => d.index)).toEqual(["00", "01", "02", "03"]);
  });

  it("the stack separates shipped work from study", () => {
    expect(STACK.map((g) => g.tier).sort()).toEqual(["shipped", "working"]);
    for (const g of STACK) {
      expect(g.items.length, g.tier).toBeGreaterThan(0);
      for (const i of g.items) expect(i.where.trim().length, i.name).toBeGreaterThan(0);
    }
  });

  it("the record covers every project", () => {
    const names = new Set(RECORD.map((r) => r.project.toLowerCase()));
    for (const p of PROJECTS) expect(names, `${p.name} missing from RECORD`).toContain(p.name.toLowerCase());
  });
});
