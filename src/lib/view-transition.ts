/**
 * View transitions, as a foundation rather than an effect.
 *
 * Phase 3 establishes the mechanism; the cinematic treatment comes later. What
 * matters now is that the mechanism can never get in the way:
 *
 *  - feature-detected, because Firefox does not support it yet
 *  - skipped entirely under reduced motion
 *  - non-blocking — navigation happens whether or not a transition runs
 *  - zero dependencies; this is a browser API, not a library
 *
 * The failure mode being designed out is a navigation that waits on an
 * animation. A transition is allowed to decorate a route change. It is never
 * allowed to be the reason one did not happen.
 */

type ViewTransitionCapableDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => {
    finished: Promise<void>;
  };
};

function transitionsAllowed(): boolean {
  if (typeof document === "undefined") return false;

  const doc = document as ViewTransitionCapableDocument;
  if (typeof doc.startViewTransition !== "function") return false;

  // `data-motion` is the site's single source of truth, resolved before first
  // paint and carrying the visitor's explicit override as well as the OS
  // preference. Reading the media query directly here would ignore the
  // override and disagree with every other motion decision on the site.
  if (document.documentElement.dataset.motion === "reduced") return false;

  return true;
}

/**
 * Runs `update` inside a view transition where that is possible and wanted,
 * and directly otherwise. Callers do not branch; they just navigate.
 */
export function withViewTransition(update: () => void): void {
  if (!transitionsAllowed()) {
    update();
    return;
  }

  const doc = document as ViewTransitionCapableDocument;
  try {
    doc.startViewTransition!(update);
  } catch {
    // An engine that advertises the API but throws must not swallow the
    // navigation with it.
    update();
  }
}
