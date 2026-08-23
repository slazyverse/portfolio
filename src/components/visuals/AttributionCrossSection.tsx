import { VAYU_LAYERS } from "@/data/projects";
import { cn } from "@/lib/cn";

/**
 * VAYU-DRISHTI drawn as strata. Sagar's layers are solid and signal-keyed;
 * the team's are hatched and credited by name and commit count.
 *
 * This exists because the honest version is the more convincing one — the
 * commit history is public, and rendering the split plainly reads as
 * confidence where a vague "collaborated on" would read as hedging.
 */
export function AttributionCrossSection() {
  return (
    <figure>
      <div className="border border-[var(--hair)] bg-[var(--panel)]">
        {VAYU_LAYERS.map((layer) => (
          <div
            key={layer.name}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-[var(--hair)] px-5 py-4 transition-colors duration-200 last:border-b-0 md:grid-cols-[minmax(0,1fr)_140px_96px]",
              layer.mine
                ? "border-l-[3px] border-l-[var(--accent)] hover:bg-[var(--raised)]"
                : "border-l-[3px] border-l-transparent bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,var(--hair-faint)_6px,var(--hair-faint)_12px)] hover:bg-[var(--raised)]",
            )}
          >
            <span
              className={cn(
                "t-small",
                layer.mine ? "text-[var(--fg-hi)]" : "text-[var(--fg-mid)]",
              )}
            >
              {layer.name}
            </span>
            <span
              className={cn(
                "t-mono col-start-1 text-[0.6875rem] md:col-start-2",
                layer.mine ? "text-[var(--accent)]" : "text-[var(--fg-low)]",
              )}
            >
              {layer.who}
            </span>
            <span className="t-mono col-start-2 row-start-1 text-right text-[0.75rem] text-[var(--fg-mid)] md:col-start-3">
              {layer.size}
            </span>
          </div>
        ))}
      </div>

      <figcaption className="t-small mt-5 max-w-[70ch] text-[var(--fg-mid)]">
        Hatched layers are the team&rsquo;s work, credited by contributor. Solid
        layers are mine. Four commits understates the share badly — those commits
        are roughly 11,700 lines across 116 files, and they are the platform the
        rest of the project runs on.
      </figcaption>
    </figure>
  );
}
