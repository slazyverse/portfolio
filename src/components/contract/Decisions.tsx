import { VerifyChip } from "@/components/system";
import type { Decision } from "@/data/types";

/* ---------------------------------------------------------------------------
 * The decisions section.
 *
 * The most useful part of an engineering dossier and the easiest to make
 * worthless. A list of technologies with a sentence of praise each tells a
 * reader nothing they could not get from the dependency file; what they are
 * looking for is evidence that choices were made under pressure, with the
 * alternative understood and the cost accepted.
 *
 * So the shape is fixed and the type enforces it: the pressure, the choice
 * against a named rejection, the reasoning in the terms the pressure was
 * stated in, and what the system can and cannot do as a result. Four parts, in
 * that order, every time — which also means a reader who has read one knows
 * how to skim the rest.
 * ------------------------------------------------------------------------- */

export function Decisions({ decisions }: { decisions: readonly Decision[] }) {
  return (
    <ol className="flex flex-col gap-px border border-[var(--hair)] bg-[var(--hair)]">
      {decisions.map((decision, i) => (
        <li key={decision.source.href + decision.choice} className="bg-[var(--panel)]">
          <article className="p-6 md:p-8">
            <p className="system-label">
              <span className="system-label-index">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[var(--fg-low)]">Decision</span>
              <span aria-hidden="true" className="system-label-rule" />
            </p>

            {/*
              The choice is the heading, because it is what the reader is
              scanning for. It is an h3: the page's h2s are the sections, and
              a dossier that flattens its decisions into paragraphs cannot be
              navigated by anybody using headings to move.
            */}
            <h3 className="t-h3 mt-5 max-w-[54ch] text-[var(--fg-hi)]">
              {decision.choice}
            </h3>

            <p className="t-mono mt-3 text-[0.75rem] text-[var(--fg-low)]">
              <span className="text-[var(--cold)]">over</span>{" "}
              <span className="text-[var(--fg-mid)]">{decision.rejected}</span>
            </p>

            <dl className="mt-7 grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-3">
              <div>
                <dt className="t-label text-[var(--fg-low)]">The pressure</dt>
                <dd className="t-small mt-2 text-[var(--fg)]">{decision.problem}</dd>
              </div>
              <div>
                <dt className="t-label text-[var(--fg-low)]">Why this way</dt>
                <dd className="t-small mt-2 text-[var(--fg)]">{decision.why}</dd>
              </div>
              <div>
                {/*
                  Signal-keyed, because the consequence is the part that
                  makes the decision checkable — and the part most people
                  leave out.
                */}
                <dt className="t-label text-[var(--accent)]">What it cost and bought</dt>
                <dd className="t-small mt-2 text-[var(--fg)]">{decision.consequence}</dd>
              </div>
            </dl>

            <div className="mt-7">
              <VerifyChip source={decision.source} />
            </div>
          </article>
        </li>
      ))}
    </ol>
  );
}
