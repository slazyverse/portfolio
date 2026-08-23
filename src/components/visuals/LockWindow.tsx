/**
 * The lock window.
 *
 * One image for the single best engineering decision in the codebase: the
 * mutex is held only long enough to copy the matrices, and the O(P²·R) search
 * runs on the snapshot afterwards. The second row is the counterfactual.
 *
 * Deliberately static HTML — no canvas, no script. It is a diagram, not an
 * animation, and it must survive print, reduced motion and no-JS intact.
 */
export function LockWindow() {
  return (
    <figure className="lift flex flex-col gap-6 border border-[var(--hair)] bg-[var(--panel)] p-6 md:p-8">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[130px_minmax(0,1fr)] md:items-center md:gap-4">
        <span className="t-label text-[var(--fg-mid)] md:text-right">
          This code
        </span>
        <div className="flex h-8 border border-[var(--hair)]">
          <div
            className="t-label flex shrink-0 items-center justify-center bg-[var(--accent)] px-2 text-[var(--color-l0)]"
            style={{ flexBasis: "9%" }}
          >
            Held
          </div>
          <div className="t-label flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-[repeating-linear-gradient(135deg,transparent,transparent_5px,var(--hair-faint)_5px,var(--hair-faint)_10px)] px-2 text-center text-[var(--fg-mid)]">
            <span className="truncate">Search runs outside the critical section</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[130px_minmax(0,1fr)] md:items-center md:gap-4">
        <span className="t-label text-[var(--fg-mid)] md:text-right">
          Naive version
        </span>
        <div className="flex h-8 border border-[var(--hair)]">
          <div className="t-label flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-[color-mix(in_srgb,var(--state-unsafe)_16%,transparent)] px-2 text-center text-[var(--state-unsafe)]">
            <span className="truncate">Mutex held for the entire O(P²·R) search</span>
          </div>
        </div>
      </div>

      <figcaption className="t-small max-w-[70ch] text-[var(--fg-mid)]">
        Copy the allocation matrices under the lock, release it, then search the
        snapshot. Other goroutines keep moving while the expensive computation
        runs. The safety check needs a <em>consistent view</em> of the state — not
        exclusive access to it for the duration.
      </figcaption>
    </figure>
  );
}
