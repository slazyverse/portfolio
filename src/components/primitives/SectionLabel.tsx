interface Props {
  index?: string;
  children: string;
}

/**
 * The eyebrow above every section head. The index is only rendered when the
 * section genuinely belongs to an ordered sequence — decoration otherwise.
 */
export function SectionLabel({ index, children }: Props) {
  return (
    <p className="t-label mb-6 flex items-center gap-3 text-[var(--fg-low)]">
      {index && <span className="text-[var(--accent)]">{index}</span>}
      <span>{children}</span>
      <span
        aria-hidden="true"
        className="h-px max-w-[120px] flex-1 bg-[var(--hair-faint)]"
      />
    </p>
  );
}
