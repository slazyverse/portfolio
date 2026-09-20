import type { Metric } from "@/data/types";
import { CountUp } from "@/components/effects/CountUp";
import { Reveal } from "@/components/effects/Reveal";

interface Props {
  metrics: Metric[];
}

/**
 * Figures only where they are countable from the repository. Tabular numerals
 * so digits stay aligned while they count into place.
 *
 * The term precedes the description in the DOM, because that is what a
 * definition list means and what a screen reader announces. The value is shown
 * above the label visually via flex `order`, which is presentation, not
 * structure. Emitting <dd> first read as "6/6" with no idea what 6/6 was.
 */
export function MetricGrid({ metrics }: Props) {
  return (
    <dl className="grid grid-cols-2 border-t border-l border-[var(--hair)] md:grid-cols-4">
      {metrics.map((m, i) => (
        <Reveal
          key={m.label}
          index={i}
          className="flex flex-col border-r border-b border-[var(--hair)] p-5"
        >
          <dt className="t-label order-2 mt-3 text-[var(--fg-low)]">{m.label}</dt>
          <dd className="tnum order-1 text-[2rem] leading-none font-medium tracking-[-0.03em] text-[var(--fg-hi)]">
            <CountUp value={m.value} />
          </dd>
          {/* A second <dd>, not a <p>: the note is a further description of the
             same term, and a <p> inside a <dl> group is invalid regardless of
             how it is wrapped. */}
          {m.note && (
            <dd className="t-mono order-3 mt-1 text-[0.6875rem] text-[var(--fg-low)]">
              {m.note}
            </dd>
          )}
        </Reveal>
      ))}
    </dl>
  );
}
