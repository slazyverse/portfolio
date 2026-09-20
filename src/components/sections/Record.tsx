import { Section } from "@/components/layout/Section";
import { SectionLabel } from "@/components/primitives/SectionLabel";
import { RECORD } from "@/data/principles";
import { Reveal } from "@/components/effects/Reveal";
import { TextReveal } from "@/components/effects/TextReveal";

/**
 * Replaces the conventional GitHub-stats widget. Stars and streaks measure
 * reach, which two projects will never win on; these measure engineering
 * practice, which they do.
 */
export function Record() {
  return (
    <Section id="record" stratum="substrate">
      <Reveal from="none">
        <SectionLabel index="05">Engineering record</SectionLabel>
      </Reveal>

      <TextReveal
        as="h2"
        id="record-heading"
        className="t-h2 mb-6"
        lines={["What is actually", "in the repositories"]}
      />
      <p className="t-lead mb-12 text-[var(--fg)]">
        Not stars or streaks. Whether there are tests, whether CI runs them, and
        whether the thing deploys.
      </p>

      <Reveal index={1} className="-mx-5 md:mx-0">
        {/* The scroll container is its own focusable region so the table can be
            panned by keyboard at narrow widths. */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Engineering record, scrollable"
          className="overflow-x-auto px-5 md:px-0"
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
                  <td className="t-small border-b border-[var(--hair-faint)] px-4 py-4 text-[var(--fg-mid)]">
                    {row.tests}
                  </td>
                  <td className="t-small border-b border-[var(--hair-faint)] px-4 py-4 text-[var(--fg-mid)]">
                    {row.ci}
                  </td>
                  <td className="t-small border-b border-[var(--hair-faint)] px-4 py-4 text-[var(--fg-mid)]">
                    {row.container}
                  </td>
                  <td className="t-small border-b border-[var(--hair-faint)] px-4 py-4 text-[var(--fg-mid)]">
                    {row.deploy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>
    </Section>
  );
}
