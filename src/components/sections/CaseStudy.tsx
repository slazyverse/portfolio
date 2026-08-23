import { Section } from "@/components/layout/Section";
import { SectionLabel } from "@/components/primitives/SectionLabel";
import { ClaimCard } from "@/components/primitives/ClaimCard";
import { MetricGrid } from "@/components/primitives/MetricGrid";
import { StateBadge } from "@/components/primitives/StateBadge";
import { StratumMarker } from "@/components/layout/StratumMarker";
import { Reveal } from "@/components/effects/Reveal";
import { TextReveal } from "@/components/effects/TextReveal";
import type { Project, Stratum, StratumId } from "@/data/types";

interface Props {
  project: Project;
  index: string;
  stratum: StratumId;
  marker?: Stratum;
  /** The project's bespoke visual — different for every case study. */
  children?: React.ReactNode;
  /** A scroll-scrubbed sequence, rendered full width below the fold. */
  sequence?: React.ReactNode;
  sequenceLabel?: string;
  sequenceCaption?: string;
}

export function CaseStudy({
  project,
  index,
  stratum,
  marker,
  children,
  sequence,
  sequenceLabel,
  sequenceCaption,
}: Props) {
  return (
    <Section id={project.slug} stratum={stratum}>
      {marker && (
        <div className="mb-16">
          <StratumMarker stratum={marker} />
        </div>
      )}

      <Reveal from="none">
        <SectionLabel index={index}>Case study</SectionLabel>
      </Reveal>

      <div className="mb-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-4">
        <TextReveal
          as="h2"
          id={`${project.slug}-heading`}
          className="t-h1"
          lines={[project.name]}
        />

        <Reveal index={1} from="none">
          <div className="flex flex-wrap items-center gap-3">
            {project.state === "live" && project.liveUrl && (
              <a href={project.liveUrl} target="_blank" rel="noopener noreferrer">
                <StateBadge state="safe">Live ↗</StateBadge>
              </a>
            )}
            <a href={project.repoUrl} target="_blank" rel="noopener noreferrer">
              <StateBadge state="signal">Source ↗</StateBadge>
            </a>
          </div>
        </Reveal>
      </div>

      <Reveal index={1}>
        <p className="t-lead mb-6 text-[var(--fg)]">{project.tagline}</p>
      </Reveal>

      {/* Ownership is stated up front, never buried. */}
      <Reveal index={2}>
        <p className="t-mono mb-10 inline-block border-l-2 border-[var(--accent)] pl-4 text-[var(--fg-mid)]">
          {project.ownership}
        </p>
      </Reveal>

      <div className="mb-12 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
        <Reveal index={3} className="flex flex-col gap-5">
          {project.summary.map((para) => (
            <p key={para.slice(0, 40)} className="t-body">
              {para}
            </p>
          ))}

          <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-3">
            {project.meta.map((m) => (
              <div key={m.label}>
                <dt className="t-label text-[var(--fg-low)]">{m.label}</dt>
                <dd className="t-mono mt-1 text-[var(--fg)]">{m.value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Reveal index={4}>{children}</Reveal>
      </div>

      {sequence && (
        <div className="mb-12">
          <Reveal from="none">
            <SectionLabel>{sequenceLabel ?? "Sequence"}</SectionLabel>
          </Reveal>
          {sequenceCaption && (
            <Reveal index={1}>
              <p className="t-lead mb-8 text-[var(--fg)]">{sequenceCaption}</p>
            </Reveal>
          )}
          {sequence}
        </div>
      )}

      <Reveal from="none">
        <h3 className="t-label mb-5 text-[var(--fg-low)]">
          What it does, and where that is proven
        </h3>
      </Reveal>

      <div className="mb-12 grid grid-cols-1 gap-5 md:grid-cols-2">
        {project.claims.map((claim, i) => (
          <Reveal key={claim.source.href + claim.statement} index={i}>
            <ClaimCard claim={claim} />
          </Reveal>
        ))}
      </div>

      <MetricGrid metrics={project.metrics} />
    </Section>
  );
}
