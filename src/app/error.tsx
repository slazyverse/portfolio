"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary. A portfolio that white-screens on a client error
 * makes exactly the wrong argument, so this stays in the site's own language
 * and offers the one action that helps.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No analytics on this site, so the console is the only reporter.
    console.error(error);
  }, [error]);

  return (
    <main
      id="main"
      className="mx-auto flex min-h-[70vh] max-w-[1180px] flex-col justify-center px-5 py-24 md:px-12"
    >
      <p className="t-label mb-6 text-[var(--state-unsafe)]">
        Unhandled exception
      </p>
      <h1 className="t-h1 mb-6">Something threw</h1>
      <p className="t-lead mb-4 text-[var(--fg-mid)]">
        A client-side error stopped this page from rendering. Retrying is
        usually enough.
      </p>
      {error.digest && (
        <p className="t-mono mb-10 text-[var(--fg-low)]">
          digest: {error.digest}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="t-label rounded-[2px] border border-[var(--accent)] px-4 py-2.5 text-[var(--accent)] transition-colors hover:bg-[var(--accent-wash)]"
        >
          Retry
        </button>
        <a
          href="/"
          className="t-label rounded-[2px] border border-[var(--hair)] px-4 py-2.5 text-[var(--fg-mid)] transition-colors hover:border-[var(--fg-mid)] hover:text-[var(--fg-hi)]"
        >
          Back to the surface
        </a>
      </div>
    </main>
  );
}
