import {
  SIGNAL_DEADLINE_MS,
  entryFitsDeadline,
  entryWindowMs,
  type EntryBeat,
  type EntryLength,
} from "@/lib/environment/entry-policy";

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

/**
 * Has this visit's landing finished, once and for all?
 *
 * The subject appears exactly once and never goes away again. That is not a
 * nicety — it is the invariant that removes an entire class of race, because
 * the renderer and the deadline run on clocks nobody controls and either can
 * win. A weak GPU made the losing order visible in production: the deadline
 * released the hero at seven seconds, the city's first frame arrived after
 * that, the camera started its opening late, and the page pulled the subject
 * back off the screen to play an introduction to a visitor who had already
 * been introduced.
 *
 * So the landing settles, and settling is terminal. Late beats are dropped
 * here, and the renderer is told separately not to bother — belt and brace,
 * because the two facts arrive by different routes.
 */
let settled = true;

/** The deadline, while an opening is waiting for the renderer to start. */
let armed: ReturnType<typeof setTimeout> | null = null;

/**
 * Is the subject still being held back, or has it already been painted?
 *
 * The inline script in the document head withholds it on a first arrival only.
 * A second arrival in the same session gets the short form — and gets the
 * finished page before the bundle runs, because nothing hid it. Taking it away
 * again to play a two-and-a-half second camera move is the same flicker as the
 * one this store exists to prevent, seen from the other side.
 *
 * So the opening still plays: the city is revealed, the scrim lifts, the
 * readout names the moves. The subject simply stays where it already is.
 */
let withholding = true;

/**
 * How long this page load has been going.
 *
 * `performance.now()` is measured from the navigation's own time origin in a
 * browser, which is exactly the clock the deadline is expressed in — the same
 * one the inline script in the document head is counting from.
 *
 * Off a document there is no navigation to measure, so the answer is zero
 * rather than a number from some other epoch: in Node that call returns time
 * since the process started, which in a test run is however long the suite has
 * been going and has nothing to do with a visitor waiting for a hero.
 */
function now(): number {
  return typeof document !== "undefined" && typeof performance !== "undefined"
    ? performance.now()
    : 0;
}

function disarm(): void {
  if (armed !== null) {
    clearTimeout(armed);
    armed = null;
  }
}

function emit(next: SignalState): void {
  // Nothing un-settles a landing. See `settled`.
  if (settled && next.phase !== "ready") return;

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
    root.dataset.signal =
      next.phase === "ready" || !withholding ? "ready" : "pending";
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

/**
 * Takes ownership of a hold the document started before the bundle existed.
 *
 * The inline script in the head withholds the subject speculatively, on the
 * two facts knowable before first paint, and expires its own hold after the
 * deadline. That expiry is measured from when the *script ran* — and a
 * synchronous inline script cannot run until every stylesheet before it has
 * loaded, because it might ask for a computed style. So on a slow connection
 * the clock starts when the CSS arrives rather than when the navigation did,
 * and the hold compounds with the thing that delayed it. Measured: with the
 * chunks held back six seconds, the subject was still hidden at twelve.
 *
 * The fix is not a shorter or longer timeout. It is that the deadline should
 * be counted from a moment the application can actually observe, and the
 * first such moment is this one — the landing mounting, which is hydration.
 * From here the store owns the hold and settles it on the same deadline it
 * uses everywhere else.
 *
 * Does nothing when an opening is already governing the hold, and nothing at
 * all when the document is not holding anything.
 */
export function holdSignal(): void {
  if (typeof document === "undefined") return;
  if (!settled || armed !== null) return;
  if (document.documentElement.dataset.signal !== "pending") return;
  // What is *left* of the deadline, not a fresh copy of it. `performance.now()`
  // is measured from the navigation's time origin, so this is the same promise
  // the head script was trying to keep, counted from the moment it should
  // always have been counted from. When the bundle arrives after the deadline
  // has already passed, the remainder is zero and the subject appears now.
  armed = setTimeout(
    () => settle("none"),
    Math.max(0, SIGNAL_DEADLINE_MS - now()),
  );
}

/**
 * Arms an opening — it does not start one.
 *
 * The distinction is the point. At this moment the landing knows the visitor
 * should get a cinematic; it does not yet know whether there is a renderer
 * capable of drawing one soon enough to be worth watching. The city is behind
 * a dynamic import, its geometry is merged and its textures generated on the
 * device, and on weak hardware the first frame can be many seconds away. So
 * the landing waits — in `signal`, with the subject withheld — and the wait is
 * bounded by the deadline rather than by hope.
 *
 * `none`, or an arrival already too late to fit an opening in before the
 * subject is due, settles immediately. Both report a length of `none`, so the
 * renderer is never handed a shot that has already been ruled out: a
 * `CityScene` that finishes mounting after this point finds nothing to play.
 */
export function beginSignal(length: EntryLength): void {
  // An opening already under way is not re-armed. The deciding effect re-runs
  // as the device facts settle, and re-arming would restart the window — or,
  // once the camera was moving, schedule an abandonment underneath it. `none`
  // is the exception, because that is how a renderer that has just failed
  // cancels the opening it was going to play.
  if (!settled && length !== "none") return;

  disarm();

  // Read once, at the only moment it is a fact: before anything this store
  // does could have changed it.
  withholding =
    typeof document === "undefined" ||
    document.documentElement.dataset.signal === "pending";

  if (length === "none" || !entryFitsDeadline(length, now())) {
    settle("none");
    return;
  }

  settled = false;
  emit({ phase: "signal", length, beat: null });

  // The window closes when the shot could no longer finish on time. Nothing
  // here is a pacing timer: it is the same deadline, subtracted.
  armed = setTimeout(
    () => settle("none"),
    Math.max(0, entryWindowMs(length) - now()),
  );
}

/**
 * The renderer has produced its first usable frame. May it play the opening?
 *
 * This is the event the landing was actually waiting for, and the answer has
 * to come back synchronously: the renderer is inside a frame callback, it is
 * about to write the camera's transform, and a round trip through React would
 * let it draw the first move of a cinematic that has already been abandoned.
 *
 * `false` means the moment has passed — the deadline settled the landing while
 * the city was still being built — and the renderer should leave the camera
 * where the route model put it.
 */
export function signalLive(): boolean {
  if (settled) return false;

  // Re-checked against the clock rather than trusted to the timer above: a
  // backgrounded tab throttles `setTimeout` but stops producing frames
  // entirely, so the two can come back in either order.
  if (!entryFitsDeadline(state.length, now())) {
    settle("none");
    return false;
  }

  // From here the shot's own last keyframe ends the landing, and it is shorter
  // than what remains of the deadline by construction.
  disarm();
  return true;
}

/** The camera has started a move. */
export function noteBeat(beat: EntryBeat): void {
  if (settled) return;
  emit({ phase: PHASE_FOR_BEAT[beat], length: state.length, beat });
}

/** The camera has reached its resting transform. */
export function endSignal(): void {
  settle(state.length);
}

function settle(length: EntryLength): void {
  disarm();
  settled = true;
  emit({ phase: "ready", length, beat: null });
}

/** Test seam. Never called by the application. */
export function resetSignal(): void {
  disarm();
  settled = true;
  withholding = true;
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
