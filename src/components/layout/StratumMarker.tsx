import type { Stratum } from "@/data/types";
import { Reveal } from "@/components/effects/Reveal";

interface Props {
  stratum: Stratum;
}

/**
 * The full-bleed transition between strata. Decorative as a heading — the
 * sections themselves carry the real document outline — so it is hidden from
 * assistive technology and the depth is announced by the rail instead.
 */
export function StratumMarker({ stratum }: Props) {
  return (
    <div aria-hidden="true" className="relative pt-4 pb-2">
      {/* The rule draws itself across as the stratum is entered — the one
          moment of overt animation, marking that a boundary was crossed. */}
      <Reveal
        from="rule"
        className="rule-draw absolute top-0 right-0 left-0 block h-px bg-[var(--hair)]"
      />

      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <Reveal from="none" index={1}>
          <span className="t-label text-[var(--accent)]">{stratum.index}</span>
        </Reveal>
        <Reveal from="none" index={2}>
          <span className="t-cond text-[0.9375rem] text-[var(--fg-hi)]">
            {stratum.name}
          </span>
        </Reveal>
        <Reveal from="none" index={3} className="hidden flex-1 sm:block">
          <span className="t-small text-[var(--fg-low)]">
            {stratum.description}
          </span>
        </Reveal>
        <Reveal from="none" index={4}>
          <span className="t-label text-[var(--fg-low)]">
            Depth {stratum.index}
          </span>
        </Reveal>
      </div>
    </div>
  );
}
