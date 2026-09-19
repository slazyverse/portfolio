import { describe, expect, it } from "vitest";
import { PROJECTS } from "@/data/projects";
import { PRINCIPLES } from "@/data/principles";
import { SITE } from "@/data/site";

/**
 * The evidence gate. Requires network; runs in CI, not in the commit loop.
 *
 * On a site whose thesis is that every claim carries its proof, a dead source
 * link is a correctness bug rather than a content nit. This suite fails the
 * build when the evidence stops resolving — including when a quoted excerpt
 * drifts from the file it claims to quote, which is how an author's annotation
 * ended up rendered as `banker.go` line 32.
 */

const RAW = (href: string) =>
  href
    .replace("https://github.com/", "https://raw.githubusercontent.com/")
    .replace("/blob/", "/")
    .split("#")[0]!;

async function head(url: string): Promise<number> {
  // GitHub rejects HEAD on some raw paths, so use a ranged GET.
  const res = await fetch(url, { headers: { Range: "bytes=0-0" } });
  return res.status;
}

const sources = [
  ...PROJECTS.flatMap((p) => p.claims.map((c) => ({ owner: p.slug, ...c.source }))),
  ...PRINCIPLES.map((p) => ({ owner: `principle-${p.index}`, ...p.source })),
  ...PROJECTS.flatMap((p) => (p.excerpt ? [{ owner: `${p.slug}-excerpt`, path: p.excerpt.file, href: p.excerpt.href }] : [])),
];

describe("every cited source still resolves", () => {
  for (const s of sources) {
    it(`${s.owner} → ${s.path}`, async () => {
      const status = await head(RAW(s.href));
      expect(status, `${s.href} returned ${status}`).toBeLessThan(400);
    });
  }
});

describe("every destination the site links to is reachable", () => {
  const targets = [
    ...PROJECTS.map((p) => p.repoUrl),
    ...PROJECTS.flatMap((p) => (p.liveUrl ? [p.liveUrl] : [])),
    SITE.github,
  ];

  for (const url of [...new Set(targets)]) {
    it(url, async () => {
      const res = await fetch(url, { redirect: "follow" });
      expect(res.status, `${url} returned ${res.status}`).toBeLessThan(400);
    });
  }
});

describe("quoted code matches the file it quotes", () => {
  for (const project of PROJECTS) {
    const ex = project.excerpt;
    if (!ex) continue;

    it(`${project.slug}: ${ex.file} is quoted verbatim`, async () => {
      const res = await fetch(RAW(ex.href));
      expect(res.status, `could not fetch ${ex.file}`).toBe(200);
      const real = (await res.text()).split(/\r?\n/);

      const mismatches: string[] = [];
      for (const line of ex.lines) {
        const actual = real[line.n - 1];
        if (actual !== line.code) {
          mismatches.push(
            `  L${line.n}\n    site: ${JSON.stringify(line.code)}\n    real: ${JSON.stringify(actual)}`,
          );
        }
      }

      expect(
        mismatches.join("\n"),
        `${mismatches.length} line(s) in ${ex.file} do not match the source:\n${mismatches.join("\n")}`,
      ).toBe("");
    });
  }
});
