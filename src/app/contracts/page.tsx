import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { Panel, StatusChip } from "@/components/system";
import { CONTRACTS } from "@/data/contracts";
import { contractPath } from "@/data/routes";
import { routeMetadata } from "@/lib/metadata";

export const metadata: Metadata = routeMetadata("contracts");

const STATE_CHIP = {
  live: { state: "safe" as const, label: "Live" },
  "in-progress": { state: "waiting" as const, label: "In progress" },
  archived: { state: "neutral" as const, label: "Archived" },
};

/**
 * The project index.
 *
 * Three entries, presented at depth rather than as a grid of cards. The
 * attribution line sits on the index itself rather than being buried inside
 * each page: whose work a thing is should be the second thing a reader learns
 * about it, not something they have to go looking for.
 */
export default function ContractsPage() {
  return (
    <PageShell
      routeId="contracts"
      lead="Three projects, in depth. Each states what it does, who built which part, and where every claim about it can be checked."
    >
      <ol className="flex flex-col gap-px border border-[var(--hair)] bg-[var(--hair)]">
        {CONTRACTS.map((contract) => {
          const chip = STATE_CHIP[contract.state];
          return (
            <li key={contract.slug}>
              <Panel className="border-0 p-6 md:p-8">
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

                <p className="t-lead mt-4 text-[var(--fg-mid)]">
                  {contract.tagline}
                </p>

                <p className="t-mono mt-5 inline-block border-l-2 border-[var(--accent)] pl-4 text-[var(--fg-mid)]">
                  {contract.attribution.summary}
                </p>

                <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
                  {contract.meta.map((m) => (
                    <div key={m.label}>
                      <dt className="t-label text-[var(--fg-low)]">{m.label}</dt>
                      <dd className="t-mono mt-1 text-[var(--fg)]">{m.value}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            </li>
          );
        })}
      </ol>
    </PageShell>
  );
}
