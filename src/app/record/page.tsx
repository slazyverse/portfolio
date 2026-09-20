import type { Metadata } from "next";
import { PageSection, PageShell } from "@/components/layout/PageShell";
import { RECORD } from "@/data/principles";
import { routeMetadata } from "@/lib/metadata";

export const metadata: Metadata = routeMetadata("record");

/**
 * The engineering record.
 *
 * This exists instead of a GitHub contribution graph, and the reasoning is
 * worth keeping: at a handful of repositories and no stars, a contribution
 * graph argues against the author. Whether a project has tests, whether CI
 * runs them, whether it containerises and whether it deploys are the measures
 * the work actually wins on, and unlike a streak they are all checkable.
 */
export default function RecordPage() {
  return (
    <PageShell
      routeId="record"
      lead="Not stars or streaks. Whether there are tests, whether CI runs them, and whether the thing deploys."
    >
      <PageSection title="Per project" index="01">
        <div
          tabIndex={0}
          role="region"
          aria-label="Engineering record, scrollable"
          className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0"
        >
          <table className="w-full min-w-[680px] border-collapse">
            <caption className="sr-only">
              Engineering practices per project: tests, continuous integration,
              containerisation and deployment status.
            </caption>
            <thead>
              <tr>
                {["Project", "Tests", "CI", "Container", "Deploy"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="t-label border-b border-[var(--hair)] px-4 py-3 text-left font-medium text-[var(--fg-low)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RECORD.map((row) => (
                <tr key={row.project}>
                  <th
                    scope="row"
                    className="t-mono border-b border-[var(--hair-faint)] px-4 py-4 text-left font-normal whitespace-nowrap text-[var(--fg-hi)]"
                  >
                    {row.project}
                  </th>
                  {[row.tests, row.ci, row.container, row.deploy].map((cell, i) => (
                    <td
                      key={i}
                      className="t-small border-b border-[var(--hair-faint)] px-4 py-4 text-[var(--fg-mid)]"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection title="Why this, and not a contribution graph" index="02">
        <p className="t-body max-w-[70ch] text-[var(--fg-mid)]">
          A contribution graph measures reach and consistency of activity. At
          four repositories and no stars it measures neither of those things
          honestly — it measures how recently someone pushed. The columns above
          measure engineering practice, which is what the work is actually good
          at, and every cell in them can be opened and checked.
        </p>
      </PageSection>
    </PageShell>
  );
}
