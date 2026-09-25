import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { StatusChip } from "@/components/system";
import { CONTRACTS } from "@/data/contracts";
import { LEVEL_NAME, contractPath, levelIndex } from "@/data/routes";
import { evidenceCount, readinessRatio } from "@/lib/contract";
import { routeMetadata } from "@/lib/metadata";

export const metadata: Metadata = routeMetadata("contracts");

const STATE_CHIP = {
  live: { state: "safe" as const, label: "Live" },
  "in-progress": { state: "waiting" as const, label: "In progress" },
  archived: { state: "neutral" as const, label: "Archived" },
};

/**
 * The work index.
 *
 * Three projects is not enough to need filtering and is exactly enough to need
 * differentiating. A reader arriving here is asking one question — is there
 * anything in this list I care about — and the answer is not the project name.
 * It is the domain, the depth, who actually built it, and how much of what is
 * said about it can be checked.
 *
 * So each row states those four things before the prose, in the same register
 * the rest of the site uses: designation and level on the left, domain and
 * state as facts, attribution as a sentence, and a count of sourced statements
 * that cannot be inflated by writing more. There is no score, no rating and no
 * "featured" — a portfolio that ranks its own work is asking the reader to
 * trust exactly the judgement they came to assess.
 */
export default function ContractsPage() {
  return (
    <PageShell
      routeId="contracts"
      lead="Three projects, in depth. Each states what it does, who built which part, and where every claim about it can be checked."
    >
      <ol className="mt-4 flex flex-col gap-px border border-[var(--hair)] bg-[var(--hair)]">
        {CONTRACTS.map((contract) => {
          const chip = STATE_CHIP[contract.state];
          const ratio = readinessRatio(contract);
          return (
            <li key={contract.slug} className="bg-[var(--panel)]">
              <article className="p-6 md:p-8">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
                  <p className="t-label text-[var(--accent)]">
                    {contract.designation}
                  </p>
                  <StatusChip state={chip.state}>{chip.label}</StatusChip>
                </div>

                <h2 className="t-h2 mt-4">
                  {/* The heading itself is the link, so the accessible name is
                      the project name rather than a generic "read more". */}
                  <Link
                    href={contractPath(contract.slug)}
                    className="text-[var(--fg-hi)] transition-colors hover:text-[var(--accent)]"
                  >
                    {contract.name}
                  </Link>
                </h2>

                <p className="t-lead mt-4 max-w-[62ch] text-[var(--fg-mid)]">
                  {contract.tagline}
                </p>

                {/*
                  The differentiators, as data rather than prose. Every value
                  is derived from the contract record: nothing here is a label
                  somebody chose for the index, so nothing here can flatter one
                  project over another.
                */}
                <dl className="mt-7 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
                  <div>
                    <dt className="t-label text-[var(--fg-low)]">Domain</dt>
                    <dd className="t-mono mt-1 text-[0.8125rem] text-[var(--fg)]">
                      {contract.domain}
                    </dd>
                  </div>
                  <div>
                    <dt className="t-label text-[var(--fg-low)]">Level</dt>
                    <dd className="t-mono mt-1 text-[0.8125rem] text-[var(--fg)]">
                      {levelIndex(contract.level)} · {LEVEL_NAME[contract.level]}
                    </dd>
                  </div>
                  <div>
                    <dt className="t-label text-[var(--fg-low)]">Sourced</dt>
                    <dd className="t-mono mt-1 text-[0.8125rem] text-[var(--fg)]">
                      {evidenceCount(contract)} statements
                    </dd>
                  </div>
                  <div>
                    <dt className="t-label text-[var(--fg-low)]">Dossier</dt>
                    <dd className="t-mono mt-1 text-[0.8125rem] text-[var(--fg)]">
                      {ratio.done}/{ratio.total} sections
                    </dd>
                  </div>
                </dl>

                {/*
                  Ownership, separated by a rule rather than by margin alone.
                  The four facts above are metadata and these two are a claim
                  about who did the work — stacked at similar weight with only
                  space between them, a reader scans past the distinction.
                */}
                <div className="mt-8 border-t border-[var(--hair-faint)] pt-7">
                  {contract.role && (
                    <p className="t-small max-w-[64ch] text-[var(--fg)]">
                      <span className="t-label mr-3 text-[var(--fg-low)]">Role</span>
                      {contract.role}
                    </p>
                  )}

                  <p className="t-mono mt-5 inline-block border-l-2 border-[var(--accent)] pl-4 text-[var(--fg-mid)]">
                    {contract.attribution.summary}
                  </p>
                </div>

                <p className="mt-8">
                  <Link
                    href={contractPath(contract.slug)}
                    className="btn"
                    // The heading is already the primary link; this one exists
                    // for the reader who has finished the row and is looking
                    // for the affordance at the end of it. Both go to the same
                    // place, so the accessible name has to distinguish them.
                    aria-label={`Open the ${contract.name} dossier`}
                  >
                    Open dossier
                    <span aria-hidden="true">&nbsp;→</span>
                  </Link>
                </p>
              </article>
            </li>
          );
        })}
      </ol>

      <p className="t-small mt-10 max-w-[70ch] text-[var(--fg-low)]">
        “Sourced statements” counts the assertions on each dossier that carry a
        file or commit behind them. It is not a quality score — it is the number
        of things on that page you can go and check.{" "}
        <Link
          href="/verify"
          className="underline underline-offset-4 transition-colors hover:text-[var(--accent)]"
        >
          All of them are listed in the evidence index.
        </Link>
      </p>
    </PageShell>
  );
}
