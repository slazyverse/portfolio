/**
 * The motion preference, as an external store.
 *
 * It genuinely is one: the value lives in the OS media query and in
 * localStorage, both of which change outside React. Reading it with
 * `useSyncExternalStore` rather than syncing it into state inside an effect
 * removes a class of cascading render, and makes the hydration boundary
 * explicit instead of implicit.
 *
 * The preference model is deliberate and predates Phase 2: the OS setting is
 * the default and is always honoured on a first visit, but it is a *default*,
 * not a verdict. Plenty of machines report `prefers-reduced-motion: reduce`
 * because the whole desktop was tuned for performance — Windows' "adjust for
 * best performance" does exactly that, and Chrome reports it as a reduced
 * motion request. So the visitor can override it either way, and the choice is
 * remembered.
 */

export type MotionMode = "full" | "reduced";

export interface MotionState {
  mode: MotionMode;
  /** True when the OS asked for reduced motion, regardless of the override. */
  systemReduced: boolean;
  /** True when the visitor has explicitly chosen, overriding the OS. */
  overridden: boolean;
}

const STORAGE_KEY = "motion";
const QUERY = "(prefers-reduced-motion: reduce)";

const listeners = new Set<() => void>();

/**
 * `useSyncExternalStore` compares snapshots by reference, so this must return
 * the *same object* until something actually changes. Recomputing on every
 * call would spin the render loop.
 */
let cached: MotionState | null = null;

/**
 * Matches what the no-flash script in the document head cannot know at build
 * time. `reduced` is the safe default: it renders the still page, which is
 * complete and readable, rather than a page mid-transition.
 */
const SERVER_STATE: MotionState = {
  mode: "reduced",
  systemReduced: false,
  overridden: false,
};

function readStored(): MotionMode | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "full" || v === "reduced" ? v : null;
  } catch {
    // Private mode, blocked storage. Fall back to the OS preference.
    return null;
  }
}

function compute(): MotionState {
  const systemReduced = window.matchMedia(QUERY).matches;
  const stored = readStored();
  return {
    systemReduced,
    overridden: stored !== null,
    mode: stored ?? (systemReduced ? "reduced" : "full"),
  };
}

function invalidate(): void {
  cached = null;
  for (const l of listeners) l();
}

export function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  const mq = window.matchMedia(QUERY);
  const onQuery = () => invalidate();
  mq.addEventListener("change", onQuery);

  // Another tab may change the preference. `storage` only fires cross-document,
  // which is exactly the case local calls to setMotionMode do not cover.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) invalidate();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onStoreChange);
    mq.removeEventListener("change", onQuery);
    window.removeEventListener("storage", onStorage);
  };
}

export function getSnapshot(): MotionState {
  cached ??= compute();
  return cached;
}

export function getServerSnapshot(): MotionState {
  return SERVER_STATE;
}

/** Records an explicit choice and notifies every subscriber. */
export function setMotionMode(mode: MotionMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Unwritable storage still gets the in-memory change below; the choice
    // simply will not survive a reload.
  }
  invalidate();
}
