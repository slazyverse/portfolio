"use client";

import Link from "next/link";
import { levelIndex, route } from "@/data/routes";
import { SITE } from "@/data/site";
import { useSignalSequence, useSignalState } from "@/components/landing/useSignal";

/* ---------------------------------------------------------------------------
 * The signature frame.
 *
 * The one composition that has to work: a city establishing scale behind it, a
 * person in front of it, and the way into the portfolio underneath. Everything
 * Phase 6 does is in service of this frame existing, and the camera exists to
 * arrive at it rather than the other way round.
 *
 * ## It is a page first
 *
 * Every word below is in the server-rendered HTML and every link is a real
 * `<Link>`. There is no state in which this section is empty, no loader in
 * front of it, and no scroll lock while the camera moves. Turn off JavaScript,
 * turn off WebGL, turn on reduced motion, or arrive on a phone: the same
 * heading, the same positioning line and the same five destinations. The
 * opening changes when they *appear*, never whether.
 *
 * ## What it says, in order
 *
 *   who      Sagar Tailor, as the heading, because the portfolio's subject is
 *            a person and the world is the room he is standing in
 *   what     the Phase 1 positioning statement, unchanged and unembellished
 *   where    five destinations, in the register the route table already uses
 *
 * No cards, no badges, no metrics, no "welcome". The evidence model means
 * every claim on this site resolves to a source, and the fastest way to break
 * that on the most-visited page would be to put an unsourced number in the
 * hero.
 * ------------------------------------------------------------------------- */

/**
 * The five destinations, selected here and described by the route table.
 *
 * The selection is a composition decision and belongs on the page making the
 * composition: `nav: true` marks eight routes, and eight rows in a signature
 * frame is a menu rather than a way in. Colophon and Verify stay one keystroke
 * away in the palette, in the footer, and on the level rail — they are not
 * hidden, they are simply not the first thing anyone needs.
 *
 * Everything *about* each one still comes from the table: the path, the level,
 * and both registers — the in-world designation and what everyone else calls
 * the thing. Restating any of those here would be a second copy free to drift,
 * and this is the page where drift would be most visible.
 */
const DESTINATION_IDS = ["dossier", "systems", "contracts", "record", "contact"] as const;
const DESTINATIONS = DESTINATION_IDS.map(route);

export function Signal() {
  useSignalSequence();
  const { phase, beat } = useSignalState();

  return (
    <section
      id="entry"
      aria-labelledby="entry-heading"
      data-phase={phase}
      className="signal flex min-h-[86vh] flex-col justify-center py-20 md:min-h-[88vh] md:py-24"
    >
      {/*
        The telemetry line.

        Real state or nothing: which move the camera is making, and the fact
        that the environment is still coming up. No percentage, no byte count,
        no invented frame rate — the interface is allowed to have atmosphere
        and is not allowed to lie about the machine.

        `aria-hidden` because it describes decoration. A screen reader hearing
        "establishing scale" would be told about a camera it cannot see, while
        the heading it actually needs sits directly below.
      */}
      <p aria-hidden="true" className="signal-boot t-mono mb-6 text-[0.6875rem] text-[var(--fg-low)]">
        <span className="text-[var(--cold)]">substrate</span>
        <span className="mx-2 text-[var(--hair-strong)]">/</span>
        <span>{BOOT_LINE[phase]}</span>
        {beat && (
          <>
            <span className="mx-2 text-[var(--hair-strong)]">/</span>
            <span className="text-[var(--fg-mid)]">{beat}</span>
          </>
        )}
      </p>

      <div className="signal-subject">
        <p className="t-label mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--fg-low)]">
          <span>{SITE.role}</span>
          <span aria-hidden="true" className="hidden h-px w-16 bg-[var(--hair-faint)] sm:block" />
          <span>{SITE.location}</span>
        </p>

        <h1 id="entry-heading" className="t-display">
          {SITE.name}
        </h1>

        <p className="t-lead mt-4 max-w-[46ch] text-[var(--fg)]">
          {SITE.statement}. Software is strata — users touch the top, and almost
          nobody sees the scheduler, the lock, the migration, the trace. Those
          are the ones I build.
        </p>

        {/*
          The way in.

          A list, because that is what it is: five places, in descent order,
          each labelled in both registers so the theme never becomes a lock on
          the content. The in-world word is the large one because this page is
          the one that establishes the register; the plain word sits under it
          so nobody has to decode anything to find the projects.
        */}
        <nav aria-label="Sections" className="mt-9">
          <ul className="flex flex-col border-t border-[var(--hair-faint)]">
            {DESTINATIONS.map((destination) => (
              <li key={destination.id}>
                <Link
                  href={destination.path}
                  className="group flex items-baseline gap-x-5 border-b border-[var(--hair-faint)] py-3 transition-colors hover:bg-[var(--raised)]"
                >
                  <span className="t-mono w-[2ch] shrink-0 text-[0.6875rem] text-[var(--accent)]">
                    {levelIndex(destination.level)}
                  </span>
                  <span className="t-cond text-[1.0625rem] tracking-[0.02em] text-[var(--fg-hi)] transition-colors group-hover:text-[var(--accent)]">
                    {destination.display}
                  </span>
                  <span className="t-small text-[var(--fg-low)]">{destination.conventional}</span>
                  <span
                    aria-hidden="true"
                    className="ml-auto t-mono text-[0.6875rem] text-[var(--fg-low)] transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="t-small mt-6 text-[var(--fg-low)]">
          <a
            href={SITE.github}
            target="_blank"
            rel="noopener noreferrer"
            // `inline-block` with vertical padding, so the target clears the
            // 24×24 minimum in WCAG 2.2 SC 2.5.8. An inline link in a
            // small-type line is 16 pixels tall, which the keyboard suite
            // caught the moment this hero replaced the old one.
            className="inline-block py-1 underline decoration-[var(--hair-strong)] underline-offset-4 transition-colors hover:text-[var(--fg-hi)] hover:decoration-[var(--accent)]"
          >
            {SITE.githubHandle} ↗
          </a>
          <span className="mx-3 text-[var(--hair-strong)]">·</span>
          <span>Every claim on this site resolves to a source.</span>
        </p>
      </div>
    </section>
  );
}

/**
 * What the readout says, per phase.
 *
 * Each line corresponds to something that has genuinely happened: the
 * environment resolving, the camera starting, the city being uncovered, the
 * hand-off to the interface. "Signal established" is the last one because that
 * is the route's own name in the table — the landing is `signal`, and the
 * opening is the moment it comes up.
 */
const BOOT_LINE: Record<string, string> = {
  signal: "initialising",
  wake: "environment synchronised",
  reveal: "resolving structure",
  subject: "signal established",
  ready: "interface ready",
};
