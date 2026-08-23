/**
 * The descent script.
 *
 * Four layers of one real request through `deadlockd`, from the surface a user
 * touches down to the mutex that makes it correct. Every line here is drawn
 * from the repository — this is the site's thesis told as a sequence rather
 * than asserted as a claim.
 */

export interface DescentLayer {
  index: string;
  /** Stratum name, in the site's language. */
  name: string;
  /** What the reader is looking at once the camera arrives. */
  headline: string;
  /** One sentence. This is a story, not documentation. */
  body: string;
  /** The artefact rendered inside the frame at this depth. */
  lines: string[];
  /** Where in the repository this layer lives. */
  path: string;
}

export const DESCENT: DescentLayer[] = [
  {
    index: "00",
    name: "Surface",
    headline: "A process asks for a resource",
    body: "This is all a user ever sees: a request, and an answer. Granted or refused, in a few milliseconds.",
    lines: [
      "P1  requests  R0 ×1",
      "",
      "→  GRANTED",
    ],
    path: "deadlockd.vercel.app",
  },
  {
    index: "01",
    name: "Interface",
    headline: "It becomes a frame on a socket",
    body: "The click is serialised and pushed over a WebSocket to the Go engine. The browser now waits.",
    lines: [
      '{ "type": "REQUEST",',
      '  "pid": 1,',
      '  "rid": 0,',
      '  "qty": 1 }',
    ],
    path: "frontend/app/hooks/useDeadlockSocket.ts",
  },
  {
    index: "02",
    name: "Engine",
    headline: "The engine refuses to guess",
    body: "The allocation is applied tentatively, then tested: is there still an order in which every process can finish?",
    lines: [
      "sim.ProcessManualRequest(1, 0, 1)",
      "  → tentatively allocate",
      "  → IsSafeState(state)?",
      "  → commit  or  rollback",
    ],
    path: "backend/engine/manager.go",
  },
  {
    index: "03",
    name: "Substrate",
    headline: "And it holds the lock for four lines",
    body: "The matrices are copied under the mutex and the lock is released. The O(P²·R) search runs on the snapshot, blocking nobody.",
    lines: [
      "state.Mu.Lock()",
      "  copy(need[i],  state.Need[i])",
      "  copy(alloc[i], state.Allocation[i])",
      "state.Mu.Unlock()",
      "",
      "// the search begins here",
    ],
    path: "backend/engine/banker.go:L15–L30",
  },
];
