import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageSection, PageShell } from "@/components/layout/PageShell";
import {
  DataRow,
  Panel,
  StatusChip,
  VerifyChip,
} from "@/components/system";
import { CodeExcerpt } from "@/components/primitives/CodeExcerpt";
import { Architecture } from "@/components/contract/Architecture";
import { Challenges, NextIteration } from "@/components/contract/Challenges";
import { Decisions } from "@/components/contract/Decisions";
import { ContractFooterNav, SectionIndex } from "@/components/contract/DossierNav";
import { Readiness } from "@/components/contract/Readiness";
import { CONTRACTS, contractBySlug } from "@/data/contracts";
import { LEVEL_NAME, contractPath, levelIndex } from "@/data/routes";
import { SITE } from "@/data/site";
import {
  contractNeighbours,
  dossierSections,
  evidenceCount,
  readinessGaps,
  readinessRatio,
  verifyAnchor,
} from "@/lib/contract";
import type { DossierSection } from "@/lib/contract";

interface Params {
  params: Promise<{ slug: string }>;
}

/**
 * Every contract is known at build time, so every contract page is static.
 * A portfolio has no reason to resolve its own content at request time, and
 * one good reason not to: a static page cannot fail in front of a reader.
 */
export function generateStaticParams() {
  return CONTRACTS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const contract = contractBySlug(slug);
  if (!contract) {
    return { title: "Not found", robots: { index: false, follow: false } };
  }

  const title = `${contract.name} — ${contract.designation}`;
  const path = contractPath(contract.slug);

  return {
    title,
    description: contract.tagline,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      url: path,
      title,
      description: contract.tagline,
      siteName: SITE.name,
    },
    twitter: { card: "summary_large_image", title, description: contract.tagline },
  };
}

const STATE_CHIP = {
  live: { state: "safe" as const, label: "Live" },
  "in-progress": { state: "waiting" as const, label: "In progress" },
  archived: { state: "neutral" as const, label: "Archived" },
};

/**
 * A single project dossier.
 *
 * The reading order is the argument. What the thing is and the proof that it
 * does it come first, because a reader decides whether to keep going inside
 * the first screen and "here is my process" is not a reason to. Everything
 * after that is depth someone opts into: how it is built, what was decided and
 * against what, what fought back, what came of it, and who actually did it.
 *
 * Section numbers come from `dossierSections`, which derives them from the
 * record after dropping what this contract does not have. That is why the
 * numbering is never a map of the gaps — a dossier running 01, 02, 05, 09
 * announces its own holes in the margin, where they are least useful, while
 * the ledger at the bottom states them properly.
 *
 * Nothing on this page is written to fill a slot. Every section that renders
 * is backed by a typed record, and the sections that are missing are missing
 * on purpose and say so.
 */
export default async function ContractPage({ params }: Params) {
  const { slug } = await params;
  const contract = contractBySlug(slug);

  // An unknown slug is not an empty page; it is a 404.
  if (!contract) notFound();

  const chip = STATE_CHIP[contract.state];
  const sections = dossierSections(contract);
  const gaps = readinessGaps(contract);
  const ratio = readinessRatio(contract);
  const neighbours = contractNeighbours(contract.slug);

  /**
   * The index this section was given, or undefined if this contract has no
   * such section. Looking it up rather than hard-coding a number is what keeps
   * the in-page nav and the page itself from disagreeing — and a test asserts
   * that every section the nav lists is present in the rendered output.
   */
  const at = (id: DossierSection["id"]): DossierSection | undefined =>
    sections.find((s) => s.id === id);

  const identification = at("identification")!;
  const context = at("objective");
  const summary = at("summary");
  const architecture = at("architecture");
  const decisions = at("decisions");
  const challenges = at("challenges");
  const results = at("results");
  const attribution = at("attribution")!;
  const evidence = at("evidence");
  const lessons = at("lessons");
  const nextIteration = at("nextIteration");

  return (
    <PageShell
      routeId="contract"
      display={contract.designation}
      conventional={contract.name}
      level={contract.level}
      lead={contract.tagline}
    >
      <SectionIndex sections={sections} />

      <PageSection
        title={identification.title}
        index={identification.index}
        anchor={identification.anchor}
      >
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip state={chip.state}>{chip.label}</StatusChip>
          {contract.liveUrl && (
            <a
              href={contract.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-signal"
            >
              Live site
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          <a
            href={contract.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
          >
            Source
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>

        {/*
          Role first, and above the metadata, because on a page about work
          somebody else may also have done, "what did he actually build" is
          the question the reader has. Burying it in a grid of labels answers
          it eventually; putting it here answers it in the first screen.
        */}
        {contract.role && (
          <div className="mt-8 border-l-2 border-[var(--accent)] pl-5">
            <p className="t-label text-[var(--fg-low)]">My role</p>
            <p className="t-body mt-2 max-w-[62ch] text-[var(--fg-hi)]">
              {contract.role}
            </p>
          </div>
        )}

        {/*
          The identity strip. Three columns rather than four: every contract
          carries six values here — domain, level, the three meta rows, and
          the evidence count — so three fills two rows exactly instead of
          leaving two holes in a row of four.
        */}
        <dl className="mt-8 grid grid-cols-2 gap-px border border-[var(--hair)] bg-[var(--hair)] md:grid-cols-3">
          {[
            { label: "Domain", value: contract.domain },
            {
              label: "Level",
              value: `${levelIndex(contract.level)} · ${LEVEL_NAME[contract.level]}`,
            },
            ...contract.meta.map((m) => ({ label: m.label, value: m.value })),
            {
              label: "Sourced statements",
              value: String(evidenceCount(contract)),
            },
          ].map((item) => (
            <div key={item.label} className="flex flex-col bg-[var(--panel)] p-4 md:p-5">
              <dt className="t-label text-[var(--fg-low)]">{item.label}</dt>
              <dd className="t-mono mt-2 text-[0.8125rem] text-[var(--fg)]">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </PageSection>

      {context && contract.objective && (
        <PageSection title={context.title} index={context.index} anchor={context.anchor}>
          <div className="grid max-w-[76ch] grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <p className="t-label mb-3 text-[var(--fg-low)]">The problem</p>
              <p className="t-body">{contract.objective.problem}</p>
            </div>
            <div>
              <p className="t-label mb-3 text-[var(--fg-low)]">Why it matters</p>
              <p className="t-body text-[var(--fg-mid)]">
                {contract.objective.whyItMatters}
              </p>
            </div>
          </div>
        </PageSection>
      )}

      {summary && (
        <PageSection title={summary.title} index={summary.index} anchor={summary.anchor}>
          <div className="mb-10 flex max-w-[68ch] flex-col gap-5">
            {contract.summary.map((para) => (
              <p key={para.slice(0, 40)} className="t-body">
                {para}
              </p>
            ))}
          </div>

          <h3 className="t-label mb-5 text-[var(--fg-low)]">
            And where that is proven
          </h3>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {contract.claims.map((claim) => (
              <figure
                key={claim.source.href + claim.statement}
                className="panel lift flex h-full flex-col justify-between gap-5 border-l-2 border-l-[var(--accent)] p-6"
              >
                <blockquote className="t-body text-[var(--fg-hi)]">
                  {claim.statement}
                </blockquote>
                <figcaption>
                  <VerifyChip source={claim.source} />
                </figcaption>
              </figure>
            ))}
          </div>
        </PageSection>
      )}

      {architecture && contract.architecture && (
        <PageSection
          title={architecture.title}
          index={architecture.index}
          anchor={architecture.anchor}
        >
          <Architecture note={contract.architecture} />
        </PageSection>
      )}

      {decisions && contract.decisions && (
        <PageSection
          title={decisions.title}
          index={decisions.index}
          anchor={decisions.anchor}
          lead="Each one states what forced it, what was rejected, the reasoning, and what it cost."
        >
          <Decisions decisions={contract.decisions} />
        </PageSection>
      )}

      {challenges && contract.challenges && (
        <PageSection
          title={challenges.title}
          index={challenges.index}
          anchor={challenges.anchor}
        >
          <Challenges challenges={contract.challenges} />
        </PageSection>
      )}

      {results && (
        <PageSection title={results.title} index={results.index} anchor={results.anchor}>
          {contract.result && contract.result.length > 0 && (
            <ul className="mb-10 flex flex-col gap-5">
              {contract.result.map((r) => (
                <li
                  key={r.source.href + r.statement}
                  className="panel flex flex-col gap-4 border-l-2 border-l-[var(--state-safe)] p-6"
                >
                  <p className="t-body text-[var(--fg-hi)]">{r.statement}</p>
                  <VerifyChip source={r.source} />
                </li>
              ))}
            </ul>
          )}

          {/*
            Counted, not claimed. Every figure here is a number someone can
            recompute from the repository — commits, lines, files — and there
            is deliberately no performance number anywhere, because none of
            these projects has been benchmarked.
          */}
          <dl className="grid grid-cols-2 border-t border-l border-[var(--hair)] md:grid-cols-4">
            {contract.metrics.map((m) => (
              <div
                key={m.label}
                className="flex flex-col border-r border-b border-[var(--hair)] p-5"
              >
                <dt className="t-label order-2 mt-3 text-[var(--fg-low)]">
                  {m.label}
                </dt>
                <dd className="tnum order-1 text-[2rem] leading-none font-medium tracking-[-0.03em] text-[var(--fg-hi)]">
                  {m.value}
                </dd>
                {m.note && (
                  <dd className="t-mono order-3 mt-1 text-[0.6875rem] text-[var(--fg-low)]">
                    {m.note}
                  </dd>
                )}
              </div>
            ))}
          </dl>
        </PageSection>
      )}

      <PageSection
        title={attribution.title}
        index={attribution.index}
        anchor={attribution.anchor}
      >
        <p className="t-lead mb-6 max-w-[64ch] text-[var(--fg)]">
          {contract.attribution.summary}
        </p>

        <Panel>
          {contract.attribution.entries.map((entry) => (
            <DataRow
              key={entry.area + entry.who}
              ownership={entry.mine ? "mine" : "other"}
              className="md:grid-cols-[minmax(0,1fr)_14ch_12ch]"
            >
              <span
                className={
                  entry.mine
                    ? "t-small text-[var(--fg-hi)]"
                    : "t-small text-[var(--fg-mid)]"
                }
              >
                {entry.area}
              </span>
              <span
                className={
                  entry.mine
                    ? "t-mono text-[var(--accent)]"
                    : "t-mono text-[var(--fg-low)]"
                }
              >
                {entry.who}
              </span>
              <span className="t-mono text-[var(--fg-mid)] md:text-right">
                {entry.size}
              </span>
            </DataRow>
          ))}
        </Panel>

        {contract.attribution.notClaimed && (
          <p className="t-small mt-6 max-w-[70ch] text-[var(--fg-mid)]">
            <span className="t-label mr-2 text-[var(--fg-low)]">Not mine:</span>
            {contract.attribution.notClaimed}
          </p>
        )}

        {contract.attribution.collaborators &&
          contract.attribution.collaborators.length > 0 && (
            <div className="mt-6">
              <p className="t-label mb-3 text-[var(--fg-low)]">Built with</p>
              <ul className="flex flex-wrap gap-x-6 gap-y-2">
                {contract.attribution.collaborators.map((person) => (
                  <li key={person.name} className="t-small text-[var(--fg)]">
                    {person.href ? (
                      <a
                        href={person.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-[var(--hair-strong)] underline-offset-4 transition-colors hover:text-[var(--accent)]"
                      >
                        {person.name}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      person.name
                    )}
                    {person.handle && (
                      <span className="t-mono ml-2 text-[0.6875rem] text-[var(--fg-low)]">
                        {person.handle}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

        {contract.attribution.evidence && (
          <div className="mt-6">
            <VerifyChip source={contract.attribution.evidence} />
          </div>
        )}
      </PageSection>

      {evidence && contract.excerpt && (
        <PageSection
          title={evidence.title}
          index={evidence.index}
          anchor={evidence.anchor}
        >
          <CodeExcerpt excerpt={contract.excerpt} />
        </PageSection>
      )}

      {lessons && contract.lessons && (
        <PageSection title={lessons.title} index={lessons.index} anchor={lessons.anchor}>
          <ul className="flex max-w-[70ch] flex-col gap-5">
            {contract.lessons.map((lesson) => (
              <li key={lesson.slice(0, 48)} className="t-body border-l-2 border-[var(--hair-strong)] pl-5">
                {lesson}
              </li>
            ))}
          </ul>
        </PageSection>
      )}

      {nextIteration && contract.nextIteration && (
        <PageSection
          title={nextIteration.title}
          index={nextIteration.index}
          anchor={nextIteration.anchor}
        >
          <NextIteration steps={contract.nextIteration} />
        </PageSection>
      )}

      {gaps.length > 0 && (
        <PageSection title="Still to write" anchor="still-to-write">
          <Readiness gaps={gaps} done={ratio.done} total={ratio.total} />
        </PageSection>
      )}

      <ContractFooterNav
        previous={neighbours.previous}
        next={neighbours.next}
        position={neighbours.position}
        total={neighbours.total}
        verifyHref={verifyAnchor(contract)}
        projectName={contract.name}
      />
    </PageShell>
  );
}
