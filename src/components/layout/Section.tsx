import type { StratumId } from "@/data/types";
import { cn } from "@/lib/cn";

interface Props {
  id: string;
  stratum: StratumId;
  children: React.ReactNode;
  className?: string;
  /** Set on the first section so it doesn't carry a top rule. */
  flush?: boolean;
}

/**
 * Vertical rhythm compresses as the page descends — 128px at the surface down
 * to 96px at the substrate. The page physically tightens as it deepens, which
 * is the descent metaphor doing work rather than being described.
 */
const RHYTHM: Record<StratumId, string> = {
  surface: "py-24 md:py-32",
  interface: "py-24 md:py-30",
  engine: "py-20 md:py-28",
  substrate: "py-20 md:py-24",
};

export function Section({ id, stratum, children, className, flush }: Props) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn(
        RHYTHM[stratum],
        !flush && "border-t border-[var(--hair-faint)]",
        className,
      )}
    >
      {children}
    </section>
  );
}
