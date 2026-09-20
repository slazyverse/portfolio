import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { Panel, VerifyChip } from "@/components/system";
import { collectEvidence, evidenceByContext } from "@/lib/evidence";
import { routeMetadata } from "@/lib/metadata";

export const metadata: Metadata = routeMetadata("verify");

const KIND_LABEL: Record<string, string> = {
  claim: "Claim",
  decision: "Decision",
  attribution: "Attribution",
  principle: "Principle",
};

/**
 * The evidence index.
 *
 * Every assertion this site makes about the work, in one place, each with the
 * file or commit that proves it. It reads the same typed records the pages
 * read, so it cannot drift from them — a hand-maintained index would be wrong
 * within a month and worth nothing the moment it was.
 *
 * Deliberately not a search interface. Filtering and faceting would be a
 * feature; being complete and checkable is the point.
 */
export default function VerifyPage() {
  const groups = evidenceByContext();
  const total = collectEvidence().length;

  return (
    <PageShell
      routeId="verify"
      lead="Everything this site claims about the work, and where each claim can be checked."
    >
      <section aria-labelledby="how-heading" className="py-12">
        <h2 id="how-heading" className="sr-only">
          How this index works
        </h2>
        <Panel surface="deep" bracket="cold">
          <div className="p-6 md:p-8">
            <p className="t-body max-w-[70ch] text-[var(--fg-mid)]">
              The content model makes evidence mandatory rather than optional.
              A claim is a type that requires a source, so no assertion about
              this work can be written without the file or commit behind it —
              the honesty rule is enforced by the compiler, not by discipline.
            </p>
            <p className="t-body mt-4 max-w-[70ch] text-[var(--fg-mid)]">
              This page is generated from those records. It is not a separate
              list maintained alongside them, which is the only reason it can
              be trusted to be complete.
            </p>
            <p className="t-mono mt-6 text-[var(--cold)]">
              {total} sourced statements across {groups.length} subjects
            </p>
          </div>
        </Panel>
      </section>

      {groups.map((group) => (
        <section
          key={group.context}
          aria-labelledby={`ev-${group.context.replace(/\W+/g, "-").toLowerCase()}`}
          className="py-8"
        >
          <p className="system-label">
            <span>{group.context}</span>
            <span aria-hidden="true" className="system-label-rule" />
          </p>
          <h2
            id={`ev-${group.context.replace(/\W+/g, "-").toLowerCase()}`}
            className="sr-only"
          >
            Evidence for {group.context}
          </h2>

          <ul className="mt-6 flex flex-col gap-px border border-[var(--hair)] bg-[var(--hair)]">
            {group.entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-4 bg-[var(--panel)] p-5 md:flex-row md:items-start md:justify-between md:gap-8 md:p-6"
              >
                <div className="min-w-0">
                  <p className="t-label text-[var(--fg-low)]">
                    {KIND_LABEL[entry.kind] ?? entry.kind}
                  </p>
                  <p className="t-body mt-2 text-[var(--fg-hi)]">
                    {entry.statement}
                  </p>
                  <p className="t-small mt-2">
                    <Link
                      href={entry.href}
                      className="text-[var(--fg-low)] underline underline-offset-4 transition-colors hover:text-[var(--accent)]"
                    >
                      Where this appears
                    </Link>
                  </p>
                </div>
                <div className="shrink-0">
                  <VerifyChip source={entry.source} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </PageShell>
  );
}
