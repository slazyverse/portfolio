"use client";

import { useScrubbedSteps } from "@/hooks/useScrubbedSteps";
import { cn } from "@/lib/cn";

/* ---------------------------------------------------------------------------
 * The safety search.
 *
 * Banker's Algorithm executing at the reader's scroll pace. Real numbers: this
 * is a four-process, three-resource system whose safe sequence is P1, P2, P3,
 * P0 — the search finds it by repeatedly looking for a process whose remaining
 * Need fits inside the current Work vector, then reclaiming that process's
 * Allocation back into Work.
 *
 * Scrolling back steps the search backwards. Under reduced motion the final
 * state renders directly, because the conclusion is the information.
 * ------------------------------------------------------------------------- */

interface Row {
  id: number;
  need: [number, number, number];
  alloc: [number, number, number];
}

const ROWS: Row[] = [
  { id: 0, need: [7, 4, 3], alloc: [0, 1, 0] },
  { id: 1, need: [1, 2, 2], alloc: [2, 0, 0] },
  { id: 2, need: [0, 0, 0], alloc: [3, 0, 2] },
  { id: 3, need: [0, 1, 1], alloc: [2, 1, 1] },
];

const INITIAL_WORK: [number, number, number] = [3, 3, 2];

/** The order the search resolves them in — derived, not asserted. */
const SEQUENCE = [1, 2, 3, 0];

/** step 0 = initial state, steps 1..4 = each process resolving, step 5 = verdict. */
const STEP_COUNT = SEQUENCE.length + 2;

function workAt(step: number): [number, number, number] {
  const work: [number, number, number] = [...INITIAL_WORK];
  for (let i = 0; i < Math.min(step, SEQUENCE.length); i += 1) {
    const row = ROWS[SEQUENCE[i]!]!;
    work[0] += row.alloc[0];
    work[1] += row.alloc[1];
    work[2] += row.alloc[2];
  }
  return work;
}

function Vector({
  values,
  tone = "default",
}: {
  values: readonly number[];
  tone?: "default" | "signal" | "safe";
}) {
  return (
    <span className="inline-flex gap-1">
      {values.map((v, i) => (
        <span
          key={i}
          className={cn(
            "step t-mono tnum inline-flex h-6 w-6 items-center justify-center border",
            tone === "signal" &&
              "border-[var(--accent)] bg-[var(--accent-wash)] text-[var(--accent)]",
            tone === "safe" &&
              "border-[color-mix(in_srgb,var(--state-safe)_40%,transparent)] text-[var(--state-safe)]",
            tone === "default" && "border-[var(--hair)] text-[var(--fg-mid)]",
          )}
        >
          {v}
        </span>
      ))}
    </span>
  );
}

export function SafetySearch() {
  const { trackRef, step, reduced } = useScrubbedSteps(STEP_COUNT);

  const resolvedCount = Math.min(step, SEQUENCE.length);
  const resolved = new Set(SEQUENCE.slice(0, resolvedCount));
  const active = step >= 1 && step <= SEQUENCE.length ? SEQUENCE[step - 1] : null;
  const work = workAt(step);
  const complete = step >= SEQUENCE.length + 1;

  return (
    // The track is tall; the figure inside sticks while it is scrolled through.
    // `sticky` does the pinning natively — no pin-spacer, no layout rewrite.
    <div ref={trackRef} className={reduced ? undefined : "relative h-[320vh]"}>
      <figure
        className={cn(
          "border border-[var(--hair)] bg-[var(--panel)]",
          !reduced && "sticky top-24",
        )}
      >
        <figcaption className="t-label flex items-center justify-between gap-4 border-b border-[var(--hair)] px-5 py-3 text-[var(--fg-low)]">
          <span>IsSafeState() — executing</span>
          <span className="tnum text-[var(--accent)]">
            {complete ? "DONE" : `STEP ${Math.min(step, SEQUENCE.length)}/${SEQUENCE.length}`}
          </span>
        </figcaption>

        <div className="overflow-x-auto" tabIndex={0}>
          <table className="w-full min-w-[440px] border-collapse">
            <caption className="sr-only">
              Banker&rsquo;s Algorithm state. Each process shows its remaining
              Need and current Allocation. The Work vector grows as processes
              resolve into the safe sequence.
            </caption>
            <thead>
              <tr>
                {["", "Need", "Allocation", ""].map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="t-label px-5 py-3 text-left font-medium text-[var(--fg-low)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const isDone = resolved.has(row.id);
                const isActive = active === row.id;
                const fits = row.need.every((n, i) => n <= work[i]!);

                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "step border-t border-[var(--hair-faint)]",
                      isActive && "bg-[var(--accent-wash)]",
                      // Resolved rows are keyed by colour (--state-safe on the
                      // label, the vector and the status) rather than faded.
                      // A 45% fade put this row's text at ~2.5:1.
                    )}
                  >
                    <th
                      scope="row"
                      className={cn(
                        "step t-mono px-5 py-3 text-left font-normal",
                        isActive
                          ? "text-[var(--accent)]"
                          : isDone
                            ? "text-[var(--state-safe)]"
                            : "text-[var(--fg-hi)]",
                      )}
                    >
                      P{row.id}
                    </th>
                    <td className="px-5 py-3">
                      <Vector
                        values={row.need}
                        tone={isActive ? "signal" : isDone ? "safe" : "default"}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <Vector values={row.alloc} />
                    </td>
                    <td className="t-mono px-5 py-3 text-[var(--fg-low)]">
                      {isDone ? (
                        <span className="text-[var(--state-safe)]">finished</span>
                      ) : fits ? (
                        <span className="text-[var(--accent)]">Need ≤ Work</span>
                      ) : (
                        <span>blocked</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--hair)] px-5 py-4">
          <span className="flex items-center gap-3">
            <span className="t-label text-[var(--fg-low)]">Work</span>
            <Vector values={work} tone={complete ? "safe" : "signal"} />
          </span>

          <span className="flex items-center gap-3">
            <span className="t-label text-[var(--fg-low)]">Sequence</span>
            <span className="t-mono tnum text-[var(--fg-hi)]">
              {resolvedCount === 0
                ? "—"
                : SEQUENCE.slice(0, resolvedCount)
                    .map((p) => `P${p}`)
                    .join(" → ")}
            </span>
          </span>
        </div>

        {/* The running state as text, so the sequence is never information that
            exists only as a visual position. */}
        <p
          aria-live="polite"
          className="t-mono border-t border-[var(--hair)] px-5 py-3 text-[var(--fg-low)]"
        >
          {complete
            ? "All four processes can finish. The state is safe."
            : resolvedCount === 0
              ? "Work starts as the Available vector: 3, 3, 2."
              : `P${SEQUENCE[resolvedCount - 1]} fits inside Work and finishes; its allocation returns to Work.`}
        </p>
      </figure>
    </div>
  );
}
