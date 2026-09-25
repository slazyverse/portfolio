import { VerifyChip } from "@/components/system";
import type { Challenge, NextStep } from "@/data/types";

/* ---------------------------------------------------------------------------
 * What fought back, and what is still unfinished.
 *
 * Two lists with the same two-part shape, and they are deliberately adjacent
 * in the reading order: the things that were hard and were dealt with, then
 * the things that are still open. A dossier that carries only the first half
 * is a brochure.
 *
 * Nothing here is a difficulty in the interview sense — no "tight deadlines",
 * no "learning a new framework". A challenge is a constraint the system had to
 * be built around, and the resolution says what the system now does about it.
 * ------------------------------------------------------------------------- */

export function Challenges({ challenges }: { challenges: readonly Challenge[] }) {
  return (
    <ul className="flex flex-col gap-px border border-[var(--hair)] bg-[var(--hair)]">
      {challenges.map((challenge) => (
        <li
          key={challenge.problem.slice(0, 48)}
          className="grid grid-cols-1 gap-x-10 gap-y-5 bg-[var(--panel)] p-6 md:p-8 lg:grid-cols-2"
        >
          <div>
            {/*
              Neutral and signal rather than red and green. The state tokens
              mean something specific in this system — unsafe and safe are
              engine states, not a rhetorical pairing — and borrowing them
              here would say "error" and "success" about a constraint that was
              never a fault. The work gets the signal colour, which is what
              amber means everywhere else on this site.
            */}
            <p className="t-label text-[var(--fg-low)]">The constraint</p>
            <p className="t-body mt-3 max-w-[54ch] text-[var(--fg-hi)]">
              {challenge.problem}
            </p>
          </div>
          <div>
            <p className="t-label text-[var(--accent)]">What the system does about it</p>
            <p className="t-small mt-3 max-w-[54ch] text-[var(--fg)]">
              {challenge.resolution}
            </p>
            {challenge.source && (
              <div className="mt-5">
                <VerifyChip source={challenge.source} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * What the repository itself records as not done.
 *
 * The lead matters as much as the list. "Next iteration" invites a wish list,
 * and a wish list on a portfolio is indistinguishable from a roadmap nobody
 * intends to build. Every entry here points at something already visible in
 * the code — an empty package, a blocked step, a hook with nothing in it — so
 * the section is a reading of the repository rather than an intention.
 */
export function NextIteration({ steps }: { steps: readonly NextStep[] }) {
  return (
    <div className="flex flex-col gap-6">
      <p className="t-small max-w-[70ch] text-[var(--fg-mid)]">
        Each of these is something the repository already records as unfinished,
        not a feature list. Where a project states no such thing, this section is
        absent rather than invented.
      </p>

      <ol className="flex flex-col gap-px border border-[var(--hair)] bg-[var(--hair)]">
        {steps.map((step, i) => (
          <li key={step.change.slice(0, 48)} className="bg-[var(--panel)] p-6 md:p-8">
            <p className="system-label">
              <span className="system-label-index">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[var(--fg-low)]">Open</span>
              <span aria-hidden="true" className="system-label-rule" />
            </p>
            <h3 className="t-h3 mt-4 max-w-[54ch] text-[var(--fg-hi)]">{step.change}</h3>
            <p className="t-small mt-4 max-w-[64ch] text-[var(--fg-mid)]">{step.why}</p>
            {step.source && (
              <div className="mt-5">
                <VerifyChip source={step.source} />
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
