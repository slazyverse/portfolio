export default function NotFound() {
  return (
    <main
      id="main"
      className="flex min-h-[70vh] flex-col justify-center py-24"
    >
      <p className="t-label mb-6 text-[var(--accent)]">Error 404</p>
      <h1 className="t-h1 mb-6">No layer here</h1>
      <p className="t-lead mb-10 text-[var(--fg-mid)]">
        That path doesn&rsquo;t resolve to anything on this site.
      </p>
      <a
        href="/"
        className="t-label self-start rounded-[2px] border border-[var(--accent)] px-4 py-2.5 text-[var(--accent)] transition-colors hover:bg-[var(--accent-wash)]"
      >
        ← Back to the surface
      </a>
    </main>
  );
}
