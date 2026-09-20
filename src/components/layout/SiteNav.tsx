import { SITE } from "@/data/site";
import { MotionToggle } from "./MotionToggle";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--hair-faint)] bg-[var(--ground)] transition-[padding] duration-300">
      <div
        className="mx-auto flex max-w-[1180px] items-center justify-between px-5 md:px-12"
        style={{
          // Condenses as the reader descends; one interpolation, no listener.
          paddingBlock: "calc(1rem - var(--scrolled, 0) * 0.3rem)",
        }}
      >
        <a
          href="#entry"
          className="t-label -my-1 inline-block py-2 text-[var(--fg-hi)] transition-colors hover:text-[var(--accent)]"
        >
          {SITE.name}
        </a>

        <div className="flex items-center gap-3">
          <a
            href={SITE.github}
            target="_blank"
            rel="noopener noreferrer"
            className="t-label rounded-[2px] border border-[var(--hair)] px-3 py-1.5 text-[var(--fg-mid)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            GitHub
          </a>
          <MotionToggle />
        </div>
      </div>
    </header>
  );
}
