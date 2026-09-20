import { cn } from "@/lib/cn";

type Tone = "default" | "value" | "signal" | "system";

interface ReadoutProps {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}

const TONE: Record<Tone, string> = {
  default: "readout",
  value: "readout readout-value",
  signal: "readout readout-signal",
  system: "readout readout-system",
};

/**
 * A measured value.
 *
 * Mono and tabular, because in this system mono means the number came from a
 * repository, a build, or a runtime measurement. That rule is load-bearing: it
 * is what stops the interface becoming costume. If a figure is set in mono, a
 * reader is entitled to ask where it came from and get an answer.
 *
 * `tone="system"` is cold rather than amber, because telemetry the site
 * reports about itself is a different kind of claim from a claim about the
 * work. Amber always means the subject; cold always means the machine.
 */
export function Readout({ children, tone = "default", className }: ReadoutProps) {
  return <span className={cn(TONE[tone], "tnum", className)}>{children}</span>;
}

interface ReadoutRowProps {
  /** What is being measured. */
  label: string;
  /** The measurement. */
  value: React.ReactNode;
  /** Optional provenance or unit, shown after the value. */
  note?: string;
  tone?: Tone;
  className?: string;
}

/**
 * A labelled measurement, leader-dotted like an instrument panel.
 *
 * Rendered as a definition group: the term precedes the description in the DOM
 * so a screen reader announces "initial JS, 189.4 KB" rather than a bare
 * number. Phase 1 shipped the inverse of this and it announced values with no
 * terms at all.
 */
export function ReadoutRow({
  label,
  value,
  note,
  tone = "value",
  className,
}: ReadoutRowProps) {
  return (
    <div
      className={cn(
        "flex items-baseline gap-3 border-b border-[var(--hair-faint)] py-2 last:border-b-0",
        className,
      )}
    >
      <dt className="t-label shrink-0 text-[var(--fg-low)]">{label}</dt>
      <span
        aria-hidden="true"
        className="min-w-4 flex-1 self-center border-b border-dotted border-[var(--hair)]"
      />
      <dd className="flex shrink-0 items-baseline gap-2">
        <Readout tone={tone}>{value}</Readout>
        {note && <span className="t-label text-[var(--fg-low)]">{note}</span>}
      </dd>
    </div>
  );
}
