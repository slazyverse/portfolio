import type { Source } from "@/data/types";

interface Props {
  source: Source;
}

/**
 * A link to the exact evidence behind an adjacent statement. Set in mono
 * because it is a machine-verifiable path, per the site's typographic rule.
 */
export function SourceLink({ source }: Props) {
  const label = source.lines ? `${source.path}:${source.lines}` : source.path;

  return (
    <a
      href={source.href}
      target="_blank"
      rel="noopener noreferrer"
      className="t-mono inline-flex items-center gap-2 rounded-[2px] border border-[color-mix(in_srgb,var(--accent)_28%,transparent)] px-2.5 py-1 text-[var(--accent)] transition-colors duration-200 hover:border-[var(--accent)] hover:bg-[var(--accent-wash)]"
    >
      <span>{label}</span>
      <span aria-hidden="true">↗</span>
      <span className="sr-only">(opens on GitHub in a new tab)</span>
    </a>
  );
}
