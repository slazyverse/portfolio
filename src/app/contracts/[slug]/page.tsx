import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageSection, PageShell } from "@/components/layout/PageShell";
import {
  DataRow,
  Panel,
  PanelBody,
  StatusChip,
  VerifyChip,
} from "@/components/system";
import { CodeExcerpt } from "@/components/primitives/CodeExcerpt";
import { CONTRACTS, contractBySlug } from "@/data/contracts";
import { contractPath } from "@/data/routes";
import { SITE } from "@/data/site";

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
 * Phase 3 builds the structure and renders exactly what the data supports.
 * Sections whose content is not written yet do not appear — they are never
 * filled with plausible prose — and the readiness ledger on each contract
 * records what is still missing, so the gap is visible rather than disguised.
 *
 * Phase 7 turns this into the deep visual case study. The ordering is already
 * the one that matters: what it does, and the proof, before any process. A
 * reader decides whether to keep going in the first screen.
 */
export default async function ContractPage({ params }: Params) {
  const { slug } = await params;
  const contract = contractBySlug(slug);

  // An unknown slug is not an empty page; it is a 404.
  if (!contract) notFound();

  const chip = STATE_CHIP[contract.state];
  const pending = Object.entries(contract.readiness).filter(
    ([, state]) => state !== "verified",
  );

  return (
    <PageShell
      routeId="contract"
      display={contract.designation}
      conventional={contract.name}
      lead={contract.tagline}
    >
      <PageSection title="Identification" index="01">
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

        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
          {contract.meta.map((m) => (
            <div key={m.label}>
              <dt className="t-label text-[var(--fg-low)]">{m.label}</dt>
              <dd className="t-mono mt-1 text-[var(--fg)]">{m.value}</dd>
            </div>
          ))}
          {contract.role && (
            <div>
              <dt className="t-label text-[var(--fg-low)]">My role</dt>
              <dd className="t-mono mt-1 text-[var(--fg)]">{contract.role}</dd>
            </div>
          )}
        </dl>
      </PageSection>

      {contract.objective && (
        <PageSection title="Objective" index="02">
          <div className="flex max-w-[68ch] flex-col gap-5">
            <p className="t-body">{contract.objective.problem}</p>
            <p className="t-body text-[var(--fg-mid)]">
              {contract.objective.whyItMatters}
            </p>
          </div>
        </PageSection>
      )}

      <PageSection title="What it does" index="03">
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

      <PageSection title="Attribution" index="04">
        <p className="t-lead mb-6 text-[var(--fg)]">
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

        {contract.attribution.evidence && (
          <div className="mt-6">
            <VerifyChip source={contract.attribution.evidence} />
          </div>
        )}
      </PageSection>

      {contract.excerpt && (
        <PageSection title="Evidence" index="05">
          <CodeExcerpt excerpt={contract.excerpt} />
        </PageSection>
      )}

      <PageSection title="Measured" index="06">
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

      {pending.length > 0 && (
        <PageSection title="Still to write" index="07">
          <Panel surface="deep">
            <PanelBody>
              <p className="t-small mb-5 max-w-[70ch] text-[var(--fg-mid)]">
                This dossier is not finished. These sections are absent rather
                than filled with plausible prose, which is the whole point:
                inventing them would cost exactly the credibility the rest of
                the page is built to earn.
              </p>
              <ul className="flex flex-wrap gap-2">
                {pending.map(([section, state]) => (
                  <li key={section} className="chip chip-cold">
                    <span>{section}</span>
                    <span className="text-[var(--fg-low)]">{state}</span>
                  </li>
                ))}
              </ul>
            </PanelBody>
          </Panel>
        </PageSection>
      )}
    </PageShell>
  );
}
