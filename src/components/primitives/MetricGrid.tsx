import type { Metric } from "@/data/types";
import { CountUp } from "@/components/effects/CountUp";
import { Reveal } from "@/components/effects/Reveal";

interface Props {
  metrics: Metric[];
}

/**
 * Figures only where they are countable from the repository. Tabular numerals
 * so digits stay aligned when Phase 4 animates them into place.
 */
export function MetricGrid({ metrics }: Props) {
  return (
    <dl className="grid grid-cols-2 border-t border-l border-[var(--hair)] md:grid-cols-4">
      {metrics.map((m, i) => (
        <Reveal
          key={m.label}
          index={i}
          className="border-r border-b border-[var(--hair)] p-5"
        >
          <dd className="tnum text-[2rem] leading-none font-medium tracking-[-0.03em] text-[var(--fg-hi)]">
            <CountUp value={m.value} />
          </dd>
          <dt className="t-label mt-3 text-[var(--fg-low)]">{m.label}</dt>
          {m.note && (
            <p className="t-mono mt-1 text-[0.6875rem] text-[var(--fg-low)]">
              {m.note}
            </p>
          )}
        </Reveal>
      ))}
    </dl>
  );
}
