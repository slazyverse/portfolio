import { Panel, PanelBody } from "@/components/system";
import type { ContentState, ContractSection } from "@/data/types";

/* ---------------------------------------------------------------------------
 * The honesty ledger.
 *
 * This is the section most portfolios would delete, and it is the one that
 * makes the rest of the page worth reading. A dossier with nine written
 * sections and two absent ones is telling the truth about itself; a dossier
 * with eleven written sections, two of which are plausible prose, is not — and
 * a reader has no way to tell them apart unless one of them says so.
 *
 * Each state means something specific, so each is labelled rather than
 * reduced to "coming soon".
 * ------------------------------------------------------------------------- */

const STATE_COPY: Record<ContentState, { label: string; tone: string; meaning: string }> = {
  verified: {
    label: "Written and sourced",
    tone: "text-[var(--state-safe)]",
    meaning: "Written, and every claim in it carries a source.",
  },
  "needs-source": {
    label: "Needs a source",
    tone: "text-[var(--accent)]",
    meaning: "Written, but an assertion in it still needs evidence attached.",
  },
  "needs-writing": {
    label: "Not written yet",
    tone: "text-[var(--cold)]",
    meaning: "Real and known, but not written up.",
  },
  "not-available": {
    label: "Nothing to write",
    tone: "text-[var(--fg-low)]",
    meaning: "No honest content exists. Rendered as absent, never as filler.",
  },
};

const SECTION_LABEL: Record<ContractSection, string> = {
  identification: "Identification",
  objective: "Context",
  result: "Results",
  architecture: "Architecture",
  decisions: "Decisions",
  challenges: "Challenges",
  evidence: "Evidence",
  attribution: "Attribution",
  lessons: "Lessons",
  nextIteration: "Next iteration",
};

export function Readiness({
  gaps,
  done,
  total,
}: {
  gaps: readonly { section: ContractSection; state: string }[];
  done: number;
  total: number;
}) {
  // The distinct states present, so the key explains what is on screen rather
  // than every state the model can express.
  const explained = [...new Set(gaps.map((g) => g.state))] as ContentState[];

  return (
    <Panel surface="deep">
      <PanelBody>
        <p className="t-mono text-[var(--cold)]">
          {done} of {total} sections written and sourced
        </p>

        <p className="t-small mt-5 max-w-[70ch] text-[var(--fg-mid)]">
          The rest are absent rather than filled with plausible prose, which is
          the whole point: inventing them would cost exactly the credibility the
          rest of this page is built to earn.
        </p>

        <ul className="mt-7 flex flex-col gap-px border border-[var(--hair)] bg-[var(--hair)]">
          {gaps.map((gap) => {
            const copy = STATE_COPY[gap.state as ContentState];
            return (
              <li
                key={gap.section}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 bg-[var(--panel)] px-5 py-3"
              >
                <span className="t-small text-[var(--fg-hi)]">
                  {SECTION_LABEL[gap.section] ?? gap.section}
                </span>
                <span className={`t-mono text-[0.6875rem] ${copy?.tone ?? ""}`}>
                  {copy?.label ?? gap.state}
                </span>
              </li>
            );
          })}
        </ul>

        {explained.length > 0 && (
          <dl className="mt-7 flex flex-col gap-2 border-t border-[var(--hair-faint)] pt-5">
            <div className="mb-1">
              <dt className="t-label text-[var(--fg-low)]">What these mean</dt>
              <dd className="sr-only">Key to the states above.</dd>
            </div>
            {explained.map((state) => (
              <div key={state} className="flex flex-wrap gap-x-3">
                <dt className={`t-mono text-[0.6875rem] ${STATE_COPY[state].tone}`}>
                  {STATE_COPY[state].label}
                </dt>
                <dd className="t-small text-[var(--fg-low)]">
                  {STATE_COPY[state].meaning}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </PanelBody>
    </Panel>
  );
}
