/**
 * One IntersectionObserver for every reveal on the page.
 *
 * The page has 71 revealing elements. Giving each its own observer means 71
 * observers, 71 sets of internal bookkeeping, and 71 callbacks the browser has
 * to reconcile on each intersection pass. A single shared observer with a
 * lookup does the identical job for one.
 */

type Callback = (el: Element) => void;

let observer: IntersectionObserver | null = null;
const callbacks = new WeakMap<Element, Callback>();

function ensure(): IntersectionObserver | null {
  if (typeof window === "undefined") return null;
  if (observer) return observer;

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const cb = callbacks.get(entry.target);
        if (cb) {
          cb(entry.target);
          callbacks.delete(entry.target);
          observer?.unobserve(entry.target);
        }
      }
    },
    // A single rootMargin serves every consumer: fire slightly before the
    // element reaches the fold so the transition starts as it arrives rather
    // than after it has already been read.
    { threshold: 0.06, rootMargin: "0px 0px -6% 0px" },
  );

  return observer;
}

/** Run `cb` once, the first time `el` enters view. Returns an unsubscribe. */
export function onFirstView(el: Element, cb: Callback): () => void {
  const io = ensure();
  if (!io) return () => {};
  callbacks.set(el, cb);
  io.observe(el);
  return () => {
    callbacks.delete(el);
    io.unobserve(el);
  };
}
