import type { EntryBeat, EntryLength } from "@/lib/environment/entry-policy";

/* ---------------------------------------------------------------------------
 * The landing, as a state machine.
 *
 * Two components that never meet need to agree about the opening: the
 * environment, which lives in the root layout and owns the camera, and the
 * hero, which lives on the landing page and owns the subject. They are not in
 * the same subtree, so passing a prop between them would mean hoisting landing
 * state into the layout — where every other route would carry it too.
 *
 * A module store instead, read through `useSyncExternalStore`, which is the
 * primitive this codebase already uses for facts that live outside React
 * (`webglStore`, `idleStore`, `qualityTierStore`). It is a fact about this
 * visit, decided once, and both readers get the same answer by construction.
 *
 * WHAT DRIVES IT IS REAL. The phase advances because the camera reached a
 * move, or because the renderer reported it cannot start, or because the
 * visitor has been here already this session. Nothing here is on a timer that
 * pretends to be progress, and nothing here gates content: the page is
 * complete and navigable in every phase, including the first one.
 * ------------------------------------------------------------------------- */

/**
 * Where the landing is.
 *
 *   signal   the environment has not started drawing yet
 *   wake     the first move: ankle height, no city
 *   reveal   the city is being uncovered — street, transit, scale, landmark
 *   subject  the camera has arrived; Sagar becomes the subject
 *   ready    the opening is over and the portfolio behaves normally
 *
 * `ready` is also the state the server renders and the state anyone gets who
 * has reduced motion on, has no WebGL, or arrived from another route. It is
 * the default, not the reward.
 */
export type SignalPhase = "signal" | "wake" | "reveal" | "subject" | "ready";

const PHASE_FOR_BEAT: Record<EntryBeat, SignalPhase> = {
  wake: "wake",
  street: "reveal",
  transit: "reveal",
  scale: "reveal",
  landmark: "reveal",
  // The subject line arrives *as* the camera settles, not after it stops.
  // Waiting for the move to finish reads as two events; this reads as one.
  subject: "subject",
};

export interface SignalState {
  phase: SignalPhase;
  length: EntryLength;
  /** The move the camera is making, for the telemetry readout. */
  beat: EntryBeat | null;
}

const IDLE: SignalState = { phase: "ready", length: "none", beat: null };

let state: SignalState = IDLE;
const listeners = new Set<() => void>();

function emit(next: SignalState): void {
  /*
   * The attribute is written every time, even when the phase has not moved.
   *
   * That is not redundant, and the case that proves it is the common one: the
   * inline script in the document head sets `pending` before first paint, and
   * a device with no WebGL then resolves to exactly the state the store
   * already held. Skipping the write on "no change" left that attribute in
   * place, and the hero stayed hidden until the script's own safety timeout
   * cleared it seven seconds later.
   */
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.dataset.signal = next.phase === "ready" ? "ready" : "pending";
    // The phase as well, because the stylesheet needs it above the content
    // column: the legibility scrim is a pseudo-element on the environment
    // layer, and the section carrying `data-phase` is not its ancestor.
    root.dataset.signalPhase = next.phase;
  }

  if (
    next.phase === state.phase &&
    next.length === state.length &&
    next.beat === state.beat
  ) {
    return;
  }
  state = next;
  for (const l of listeners) l();
}

export const signalStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): SignalState {
    return state;
  },
  /**
   * The server renders the finished landing.
   *
   * Deliberately: the markup that reaches a reader with no JavaScript, a
   * crawler, or a browser that fails to hydrate is the complete page with the
   * subject visible. The opening is something the client may add, never
   * something the server withholds.
   */
  getServerSnapshot(): SignalState {
    return IDLE;
  },
};

/** Begins an opening. `none` resolves the landing immediately. */
export function beginSignal(length: EntryLength): void {
  if (length === "none") {
    emit({ phase: "ready", length: "none", beat: null });
    return;
  }
  emit({ phase: "signal", length, beat: null });
}

/** The camera has started a move. */
export function noteBeat(beat: EntryBeat): void {
  emit({ phase: PHASE_FOR_BEAT[beat], length: state.length, beat });
}

/** The camera has reached its resting transform. */
export function endSignal(): void {
  emit({ phase: "ready", length: state.length, beat: null });
}

/** Test seam. Never called by the application. */
export function resetSignal(): void {
  state = IDLE;
  visits = 0;
  for (const l of listeners) l();
}

/* ------------------------------------------------------- which arrival --- */

let visits = 0;

/**
 * How many times the landing has mounted in this page session, before now.
 *
 * A module counter, which is exactly the distinction needed: a full page load
 * resets it, and a client-side route change does not. Zero means the visitor
 * arrived here; anything else means they came back through the site.
 *
 * The Navigation Timing API cannot answer this — an App Router route change
 * creates no navigation entry, so the original `navigate` entry is still the
 * only one there and every return looks like a fresh arrival.
 */
export function countLandingVisit(): number {
  return visits++;
}

/* ------------------------------------------------------------- this visit --- */

const SEEN_KEY = "substrate:signal-seen";

/**
 * Has this browser already watched the opening in this session?
 *
 * `sessionStorage`, not `localStorage`: a visitor returning next week should
 * see the world introduced again, and a visitor who opened four tabs an hour
 * ago should not sit through it four times. Wrapped because private mode and
 * blocked site data both throw on access, and the honest fallback is "no" —
 * an opening shown twice is a smaller failure than a hero that never appears.
 */
export function hasSeenSignal(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) !== null;
  } catch {
    return false;
  }
}

export function markSignalSeen(): void {
  try {
    window.sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Nothing to do. The cost is a repeated opening, not a broken page.
  }
}
