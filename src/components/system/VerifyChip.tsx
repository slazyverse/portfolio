import type { Source } from "@/data/types";
import { cn } from "@/lib/cn";

interface Props {
  source: Source;
  /** Shows the file path. Off where the surrounding row already names it. */
  showPath?: boolean;
  className?: string;
}

/**
 * The site's signature interaction.
 *
 * SUBSTRATE's whole premise is that a claim cannot exist without the evidence
 * behind it — the `Claim` type makes a `Source` mandatory, so no assertion
 * about the work can compile without the file or commit that proves it. This
 * component is what that rule looks like on screen.
 *
 * It is styled as a control rather than a footnote on purpose. A reader should
 * be able to tell at a glance that every statement here is checkable, and then
 * check one. The affordance is the argument.
 *
 * Accessibility:
 *  - a real anchor, so it is keyboard-reachable and works with middle-click
 *  - the accessible name states both the file and that it opens off-site,
 *    because "opens in a new tab" with no warning is disorienting
 *  - the arrow is decorative and hidden from assistive technology
 *  - hover is an enhancement; the border and colour already distinguish it
 */
export function VerifyChip({ source, showPath = true, className }: Props) {
  const label = source.lines ? `${source.path}:${source.lines}` : source.path;

  return (
    <a
      href={source.href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("verify", className)}
    >
      <span aria-hidden="true" className="t-label">
        Verify
      </span>
      {showPath && <span className="text-[var(--fg-mid)]">{label}</span>}
      <span aria-hidden="true">&#8599;</span>
      <span className="sr-only">
        Verify: open {label} on GitHub in a new tab
      </span>
    </a>
  );
}
