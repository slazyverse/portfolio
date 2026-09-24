"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useMotionAllowed } from "@/components/providers/MotionProvider";
import { useEnvironment } from "@/components/environment/useEnvironment";
import { entryLength } from "@/lib/environment/entry-policy";
import {
  beginSignal,
  countLandingVisit,
  hasSeenSignal,
  markSignalSeen,
  signalStore,
  type SignalState,
} from "./signal-store";

/** Reads the landing phase. Safe on any route; `ready` everywhere else. */
export function useSignalState(): SignalState {
  return useSyncExternalStore(
    signalStore.subscribe,
    signalStore.getSnapshot,
    signalStore.getServerSnapshot,
  );
}

/**
 * Decides what opening this visit gets, and starts it.
 *
 * Every input is a real fact rather than a preference about pacing: whether
 * the visitor asked for less motion, whether the city is the thing actually
 * rendering, which tier the device resolved to, whether this browser has been
 * shown the opening already in this session, and whether they arrived here
 * from inside the site.
 *
 * Two of those arrive late. The quality tier and the WebGL probe resolve after
 * hydration, and the environment waits for the page to go idle before it
 * builds anything — so this re-runs when they settle rather than guessing
 * early. Until then the landing sits in `ready`, which is the complete page:
 * nobody is ever waiting on this decision in order to read something.
 */
export function useSignalSequence(): void {
  const motion = useMotionAllowed();
  const { mode, tier, resolved } = useEnvironment();

  /*
   * Which arrival this is — counted once per mount, not once per effect run.
   *
   * This was a real defect and an instructive one. The effect below re-runs
   * as the device facts settle: the tier resolves, then WebGL, then the idle
   * gate. Counting inside it meant the *same* arrival was counted three or
   * four times, the second count reported "you came back through the site",
   * and the opening cancelled itself about a second and a half in — the
   * camera visibly jumped to its resting transform and the hero appeared
   * during the first move.
   *
   * A lazy `useState` initialiser runs exactly once per mount, which is the
   * granularity that actually matches the question. It is guarded for the
   * server because the counter is module state there, shared between
   * requests, and a landing page must not know how many other people have
   * loaded it.
   */
  const [arrival] = useState(() =>
    typeof window === "undefined" ? 0 : countLandingVisit(),
  );

  useEffect(() => {
    /*
     * Wait for the environment to finish deciding.
     *
     * `mode` is `none` both before the page has gone idle and after the
     * environment has stood down for good, and the difference matters here
     * more than anywhere else. Resolving against the first one meant
     * concluding there was no cinematic, revealing the hero, and then
     * starting a camera move behind a page that had already introduced
     * itself — the subject arriving before the world it stands in.
     *
     * Nothing is waiting on this. The landing sits in `ready` until it
     * resolves, which is the complete page.
     */
    if (!resolved) return;

    // A full page load resets the counter and a client-side route change does
    // not, so anything past the first mount means the visitor reached Home
    // from somewhere else in the site — and replaying the world's
    // introduction to someone who never left it would be telling them where
    // they already are.
    const internal = arrival > 0;
    const seen = hasSeenSignal();

    const length = entryLength({
      reducedMotion: !motion,
      seen,
      internal,
      tier,
      webgl: mode === "webgl",
    });

    beginSignal(length);
    // Marked on arrival rather than on completion. Someone who navigates away
    // three seconds in has seen the world introduced; making them sit through
    // the long version again because they did not watch it to the end would
    // be punishing them for exploring.
    markSignalSeen();
  }, [motion, mode, tier, resolved, arrival]);
}
