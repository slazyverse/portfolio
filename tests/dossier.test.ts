import { describe, expect, it } from "vitest";
import { CONTRACTS, contractBySlug } from "@/data/contracts";
import { collectEvidence } from "@/lib/evidence";
import {
  contractNeighbours,
  dossierSections,
  evidenceCount,
  readinessGaps,
  readinessRatio,
  verifyAnchor,
} from "@/lib/contract";
import type { Contract, ContractSection } from "@/data/types";

/**
 * The dossier.
 *
 * Phase 7 turns three project pages into engineering records, and the risk it
 * introduces is the one this whole site is built against: a deep template
 * invites filler. Eleven sections is eleven slots, and a slot is a standing
 * invitation to write something plausible.
 *
 * So the assertions here are mostly about honesty rather than rendering. That
 * a section which claims to be written actually has content. That a section
 * with content is not still declared unwritten. That every decision names what
 * it rejected and what it cost, because a decision missing either is a
 * preference. That the count on the index is the same count `/verify` would
 * produce, because a number nobody can reconcile is worse than no number.
 */

/**
 * Does this contract have real content for this section?
 *
 * Written out here rather than imported from `lib/contract`, deliberately. The
 * point of the readiness test below is to check the declaration against the
 * data by an independent route; sharing the predicate with the code under test
 * would make it agree with itself.
 */
function hasContent(contract: Contract, section: ContractSection): boolean {
  switch (section) {
    case "identification":
      return contract.name.length > 0 && contract.meta.length > 0;
    case "objective":
      return Boolean(contract.objective);
    case "result":
      return contract.metrics.length > 0 || (contract.result?.length ?? 0) > 0;
    case "architecture":
      return Boolean(contract.architecture);
    case "decisions":
      return (contract.decisions?.length ?? 0) > 0;
    case "challenges":
      return (contract.challenges?.length ?? 0) > 0;
    case "evidence":
      return contract.claims.length > 0;
    case "attribution":
      return contract.attribution.entries.length > 0;
    case "lessons":
      return (contract.lessons?.length ?? 0) > 0;
    case "nextIteration":
      return (contract.nextIteration?.length ?? 0) > 0;
  }
}

/** A source's displayed path should name the file its link opens. */
function pathMatchesHref(path: string, href: string): boolean {
  const file = path.split(/[\s—]/)[0]!.split("/").filter(Boolean).pop();
  return !file || href.includes(file);
}

/* ------------------------------------------------------------- honesty --- */

describe("readiness describes what is actually there", () => {
  it("never calls a section verified when it has no content", () => {
    for (const contract of CONTRACTS) {
      for (const [section, state] of Object.entries(contract.readiness)) {
        if (state !== "verified") continue;
        expect(
          hasContent(contract, section as ContractSection),
          `${contract.slug} declares ${section} verified but carries nothing for it`,
        ).toBe(true);
      }
    }
  });

  it("never leaves a written section declared unwritten", () => {
    // The failure mode that hides real work: a section gets filled in and the
    // ledger is not updated, so the page reports a gap that closed.
    for (const contract of CONTRACTS) {
      for (const [section, state] of Object.entries(contract.readiness)) {
        if (state !== "needs-writing") continue;
        expect(
          hasContent(contract, section as ContractSection),
          `${contract.slug} says ${section} is unwritten, but content exists`,
        ).toBe(false);
      }
    }
  });

  it("keeps the ledger consistent with what the page renders", () => {
    for (const contract of CONTRACTS) {
      const rendered = new Set(dossierSections(contract).map((s) => s.id));
      for (const { section } of readinessGaps(contract)) {
        // A gap is a section the page does not render. If it rendered, it
        // would be showing content the ledger says does not exist.
        expect(
          rendered.has(section),
          `${contract.slug} renders ${section} and also reports it as a gap`,
        ).toBe(false);
      }
    }
  });

  it("counts the ratio out of the sections actually declared", () => {
    for (const contract of CONTRACTS) {
      const ratio = readinessRatio(contract);
      expect(ratio.total).toBe(Object.keys(contract.readiness).length);
      expect(ratio.done).toBeLessThanOrEqual(ratio.total);
      expect(ratio.done + readinessGaps(contract).length).toBe(ratio.total);
    }
  });
});

/* ----------------------------------------------------------- decisions --- */

describe("a decision is stated in all four parts", () => {
  const decisions = CONTRACTS.flatMap((c) =>
    (c.decisions ?? []).map((d) => ({ slug: c.slug, ...d })),
  );

  it("exists at all", () => {
    expect(decisions.length).toBeGreaterThan(0);
  });

  for (const d of decisions) {
    describe(`${d.slug}: ${d.choice.slice(0, 44)}…`, () => {
      it("names the pressure that forced it", () => {
        expect(d.problem.trim().length).toBeGreaterThan(40);
      });

      it("names what was rejected", () => {
        // The rejection is the informative half. "Chose X" with nothing on the
        // other side of it is a technology list entry.
        expect(d.rejected.trim().length).toBeGreaterThan(10);
        expect(d.rejected.toLowerCase()).not.toBe(d.choice.toLowerCase());
      });

      it("gives reasoning and a consequence", () => {
        expect(d.why.trim().length).toBeGreaterThan(40);
        expect(d.consequence.trim().length).toBeGreaterThan(40);
      });

      it("points at a file that its label names", () => {
        expect(d.source.href).toMatch(/^https:\/\/github\.com\//);
        expect(
          pathMatchesHref(d.source.path, d.source.href),
          `label says ${d.source.path} but the link does not contain it`,
        ).toBe(true);
      });
    });
  }
});

/* -------------------------------------------------------- architecture --- */

describe("architecture is described rather than illustrated", () => {
  it("carries a summary, and detail for every layer and stage", () => {
    for (const c of CONTRACTS) {
      const a = c.architecture;
      if (!a) continue;
      expect(a.summary.trim().length, c.slug).toBeGreaterThan(60);
      for (const layer of a.layers ?? []) {
        expect(layer.name.trim().length, `${c.slug} layer`).toBeGreaterThan(2);
        expect(layer.detail.trim().length, `${c.slug} ${layer.name}`).toBeGreaterThan(20);
      }
      for (const step of a.flow ?? []) {
        expect(step.stage.trim().length, `${c.slug} stage`).toBeGreaterThan(2);
        expect(step.detail.trim().length, `${c.slug} ${step.stage}`).toBeGreaterThan(15);
      }
    }
  });

  it("names each layer and stage once", () => {
    for (const c of CONTRACTS) {
      const layers = (c.architecture?.layers ?? []).map((l) => l.name);
      const stages = (c.architecture?.flow ?? []).map((s) => s.stage);
      expect(layers, `${c.slug} repeats a layer`).toEqual([...new Set(layers)]);
      expect(stages, `${c.slug} repeats a stage`).toEqual([...new Set(stages)]);
    }
  });
});

/* -------------------------------------------- challenges and next work --- */

describe("challenges and open work stay concrete", () => {
  it("states a constraint and what the system does about it", () => {
    for (const c of CONTRACTS) {
      for (const challenge of c.challenges ?? []) {
        expect(challenge.problem.trim().length, c.slug).toBeGreaterThan(40);
        expect(challenge.resolution.trim().length, c.slug).toBeGreaterThan(40);
        if (challenge.source) {
          expect(challenge.source.href).toMatch(/^https:\/\//);
          expect(pathMatchesHref(challenge.source.path, challenge.source.href)).toBe(true);
        }
      }
    }
  });

  it("gives every open item a reason, and no generic filler", () => {
    const banned = /add more features|improve performance|refactor|polish|better ux/i;
    for (const c of CONTRACTS) {
      for (const step of c.nextIteration ?? []) {
        expect(step.change.trim().length, c.slug).toBeGreaterThan(30);
        expect(step.why.trim().length, c.slug).toBeGreaterThan(40);
        expect(step.change, `${c.slug}: generic next step`).not.toMatch(banned);
      }
    }
  });
});

/* ------------------------------------------------------- page assembly --- */

describe("the dossier assembles from the record", () => {
  it("numbers its sections contiguously from 01", () => {
    for (const c of CONTRACTS) {
      const sections = dossierSections(c);
      expect(sections.length, c.slug).toBeGreaterThan(4);
      sections.forEach((s, i) => {
        expect(s.index, `${c.slug} section ${i}`).toBe(String(i + 1).padStart(2, "0"));
      });
    }
  });

  it("lists only sections the contract actually has", () => {
    for (const c of CONTRACTS) {
      for (const section of dossierSections(c)) {
        if (section.id === "summary") {
          expect(c.summary.length, c.slug).toBeGreaterThan(0);
          continue;
        }
        if (section.id === "results") {
          expect(hasContent(c, "result"), c.slug).toBe(true);
          continue;
        }
        expect(
          hasContent(c, section.id),
          `${c.slug} lists ${section.id} with nothing behind it`,
        ).toBe(true);
      }
    }
  });

  it("omits a section a contract does not have", () => {
    // deadlockd has no next-iteration entries, and no dossier should invent
    // one for it.
    const deadlockd = contractBySlug("deadlockd")!;
    expect(deadlockd.nextIteration).toBeUndefined();
    expect(dossierSections(deadlockd).map((s) => s.id)).not.toContain("nextIteration");

    // And nobody has lessons yet, so nobody shows a lessons section.
    for (const c of CONTRACTS) {
      expect(dossierSections(c).map((s) => s.id), c.slug).not.toContain("lessons");
    }
  });

  it("gives every section a unique, url-safe anchor", () => {
    for (const c of CONTRACTS) {
      const anchors = dossierSections(c).map((s) => s.anchor);
      expect(anchors, c.slug).toEqual([...new Set(anchors)]);
      for (const a of anchors) expect(a, `${c.slug}: ${a}`).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

/* -------------------------------------------------------- navigation ----- */

describe("moving between contracts", () => {
  it("does not wrap at either end", () => {
    const first = contractNeighbours(CONTRACTS[0]!.slug);
    const last = contractNeighbours(CONTRACTS[CONTRACTS.length - 1]!.slug);
    expect(first.previous).toBeUndefined();
    expect(first.next?.slug).toBe(CONTRACTS[1]!.slug);
    expect(last.next).toBeUndefined();
    expect(last.previous?.slug).toBe(CONTRACTS[CONTRACTS.length - 2]!.slug);
  });

  it("reports an honest position in the list", () => {
    CONTRACTS.forEach((c, i) => {
      const n = contractNeighbours(c.slug);
      expect(n.position).toBe(i + 1);
      expect(n.total).toBe(CONTRACTS.length);
    });
  });

  it("links neighbours by their canonical path", () => {
    for (const c of CONTRACTS) {
      const n = contractNeighbours(c.slug);
      for (const neighbour of [n.previous, n.next]) {
        if (!neighbour) continue;
        expect(neighbour.path).toBe(`/contracts/${neighbour.slug}`);
        expect(neighbour.name.length).toBeGreaterThan(0);
        expect(neighbour.designation).toMatch(/^CONTRACT \d\d$/);
      }
    }
  });

  it("points at the right part of the evidence index", () => {
    for (const c of CONTRACTS) {
      const anchor = verifyAnchor(c);
      expect(anchor.startsWith("/verify#ev-"), c.slug).toBe(true);
      // The same id `/verify` derives for this subject's group heading. If
      // these ever diverge the link silently lands at the top of the page.
      const expected = `ev-${c.name.replace(/\W+/g, "-").toLowerCase()}`;
      expect(anchor).toBe(`/verify#${expected}`);
    }
  });
});

/* ------------------------------------------------------------ evidence --- */

describe("the evidence count is the number it claims to be", () => {
  it("matches what the evidence index collects for that project", () => {
    const entries = collectEvidence();
    for (const c of CONTRACTS) {
      const indexed = entries.filter((e) => e.context === c.name).length;
      expect(
        evidenceCount(c),
        `${c.slug}: the index badge says ${evidenceCount(c)} and /verify lists ${indexed}`,
      ).toBe(indexed);
    }
  });

  it("sends every entry to the section it appears in", () => {
    const anchors = new Set(
      CONTRACTS.flatMap((c) => dossierSections(c).map((s) => s.anchor)),
    );
    for (const entry of collectEvidence()) {
      if (entry.kind === "principle") continue;
      const [path, anchor] = entry.href.split("#");
      expect(path, entry.id).toMatch(/^\/contracts\//);
      expect(anchor, `${entry.id} points at no section`).toBeTruthy();
      expect(anchors, `${entry.id} points at ${anchor}, which no dossier has`).toContain(
        anchor!,
      );
    }
  });
});

/* ------------------------------------------------------------- the index -- */

describe("the work index differentiates without ranking", () => {
  it("gives every contract a domain", () => {
    const domains = CONTRACTS.map((c) => c.domain);
    for (const d of domains) {
      expect(d.trim().length).toBeGreaterThan(3);
      expect(d.length, `"${d}" is too long for an index cell`).toBeLessThan(28);
    }
    // Three projects that all say the same thing differentiate nothing.
    expect(domains).toEqual([...new Set(domains)]);
  });

  it("carries no score, rating or ordering claim", () => {
    // Guards the rule rather than the markup: nothing in the record may be a
    // judgement of one project against another.
    const record = JSON.stringify(CONTRACTS);
    for (const banned of ["featured", "rating", "score out of", "best project"]) {
      expect(record.toLowerCase(), `the index data mentions "${banned}"`).not.toContain(
        banned,
      );
    }
  });
});
