import { SITE } from "@/data/site";

export function Footer() {
  return (
    <footer className="border-t border-[var(--hair)] bg-[var(--deep)]">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-5 py-8 md:px-12">
        <p className="t-label text-[var(--fg-low)]">
          {SITE.name} — {SITE.role}
        </p>
        <p className="t-label text-[var(--fg-low)]">
          Built with Next.js · No analytics · No trackers
        </p>
      </div>
    </footer>
  );
}
