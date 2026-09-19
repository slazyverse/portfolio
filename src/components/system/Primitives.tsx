import { cn } from "@/lib/cn";

/* ---------------------------------------------------------------------------
 * The small structural pieces the system is assembled from.
 *
 * Everything here is presentational and token-driven. None of it carries
 * information that is not also in the DOM as text, which is the rule that lets
 * the whole decorative layer be removed under forced colors and reduced motion
 * without anything being lost.
 * ------------------------------------------------------------------------- */

/** The eyebrow above a region. Mono, because it names a part of the system. */
export function SystemLabel({
  children,
  index,
  rule = true,
  className,
}: {
  children: React.ReactNode;
  /** Only where the region genuinely belongs to an ordered sequence. */
  index?: string;
  rule?: boolean;
  className?: string;
}) {
  return (
    <p className={cn("system-label", className)}>
      {index && <span className="system-label-index">{index}</span>}
      <span>{children}</span>
      {rule && <span aria-hidden="true" className="system-label-rule" />}
    </p>
  );
}

/**
 * A horizontal rule.
 *
 * `segmented` reads as discrete steps rather than a continuous span, which is
 * the right signal above a stepped sequence. Rendered as <hr> so it is a real
 * separator to assistive technology rather than a styled div.
 */
export function Divider({
  tone = "default",
  className,
}: {
  tone?: "default" | "faint" | "segmented";
  className?: string;
}) {
  return (
    <hr
      className={cn(
        tone === "faint" && "divider divider-faint",
        tone === "segmented" && "divider-segmented",
        tone === "default" && "divider",
        className,
      )}
    />
  );
}

/**
 * Atmospheric overlays.
 *
 * Capped at 3% opacity in the stylesheet so they cannot affect the contrast of
 * anything beneath them, always `aria-hidden`, and removed entirely under
 * reduced motion and forced colors. They carry no information — if they ever
 * did, they would have to stop being decorative.
 */
export function ScanLine({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("scanline", className)} />;
}

export function Vignette({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("vignette", className)} />;
}

/** A single sweep on arrival, not a loop. */
export function Scan({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("scan", className)} />;
}

/**
 * A record in a list of records.
 *
 * `ownership` marks whose work a row represents. It exists because the honest
 * version of a team project is the more convincing one: rendering the split
 * plainly reads as confidence, where a vague "collaborated on" reads as
 * hedging. Rows that are not the subject's are hatched rather than faded —
 * opacity would put their text below AA.
 */
export function DataRow({
  children,
  ownership = "none",
  className,
}: {
  children: React.ReactNode;
  ownership?: "mine" | "other" | "none";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "data-row",
        ownership === "mine" && "data-row-mine",
        ownership === "other" && "data-row-other",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The full-bleed transition between levels.
 *
 * Decorative as a heading — the sections themselves carry the real document
 * outline — so it is hidden from assistive technology and the depth is
 * announced by the navigation instead. Rendering it as a heading would put a
 * second, competing outline into the page.
 */
export function SectionMarker({
  index,
  name,
  description,
  className,
}: {
  index: string;
  name: string;
  description?: string;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={cn("relative pt-4 pb-2", className)}>
      <span className="absolute top-0 right-0 left-0 block h-px bg-[var(--hair)]" />
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <span className="t-label text-[var(--accent)]">{index}</span>
        <span className="t-cond text-[0.9375rem] text-[var(--fg-hi)]">{name}</span>
        {description && (
          <span className="t-small hidden flex-1 text-[var(--fg-low)] sm:block">
            {description}
          </span>
        )}
        <span className="t-label text-[var(--fg-low)]">Depth {index}</span>
      </div>
    </div>
  );
}
