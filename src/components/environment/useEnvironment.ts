"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { useMotionAllowed } from "@/components/providers/MotionProvider";
import {
  canvas2dStore,
  idleStore,
  qualityTierStore,
  webglStore,
  type QualityTier,
} from "@/lib/capability";
import { resolveEnvironmentMode, type EnvironmentMode } from "@/lib/environment/quality";

export interface EnvironmentState {
  mode: EnvironmentMode;
  tier: QualityTier;
  motion: boolean;
  /**
   * Has the environment finished deciding?
   *
   * `mode` alone cannot answer that: `none` is both "not yet" and "never".
   * The landing needs the difference, because resolving the opening against a
   * `none` that simply had not arrived yet meant deciding there was no
   * cinematic, revealing the hero, and then starting a camera move behind a
   * page that had already introduced itself.
   */
  resolved: boolean;
  /** Reports an unrecoverable renderer failure. The environment steps down. */
  fail: (reason: string) => void;
  /** Why the environment stepped down, if it did. Development diagnostics only. */
  failure?: string;
}

/**
 * Resolves how the environment should render on this device, right now.
 *
 * Three facts decide it — the quality tier, whether WebGL exists, whether a 2D
 * context exists — and they are combined by one pure function that is tested
 * directly. Nothing here branches on its own.
 *
 * ## Why all three inputs are stores
 *
 * Every one of them is a fact about the machine that the server cannot know,
 * that is measured once, and that never changes afterwards. That is precisely
 * what `useSyncExternalStore` with a server snapshot describes — and it is
 * what the Phase 2 capability module already established for WebGL.
 *
 * The alternative, `useState` filled in by an effect, would be a second render
 * triggered by a value that was never going to change, and would need a
 * `mounted` flag to avoid a hydration mismatch. Hydration correctness is
 * something the store gives for free: React renders the server snapshot while
 * hydrating and swaps to the real one immediately afterwards.
 *
 * Each server snapshot names the cheapest possible answer, so the hydrating
 * markup is the one that asks least of the device. Anything better is an
 * upgrade applied after hydration, never a downgrade retracted during it.
 */
export function useEnvironment(): EnvironmentState {
  const motion = useMotionAllowed();
  const webgl = useSyncExternalStore(
    webglStore.subscribe,
    webglStore.getSnapshot,
    webglStore.getServerSnapshot,
  );
  const canvas2d = useSyncExternalStore(
    canvas2dStore.subscribe,
    canvas2dStore.getSnapshot,
    canvas2dStore.getServerSnapshot,
  );

  const tier = useSyncExternalStore(
    qualityTierStore.subscribe,
    qualityTierStore.getSnapshot,
    qualityTierStore.getServerSnapshot,
  );

  // The environment waits for the page to be done with the main thread.
  // Content first, atmosphere second — always, and not only on slow devices.
  const ready = useSyncExternalStore(
    idleStore.subscribe,
    idleStore.getSnapshot,
    idleStore.getServerSnapshot,
  );

  const [failure, setFailure] = useState<string | undefined>();

  const fail = useCallback((reason: string) => {
    // One-way. A renderer that has lost its context does not get retried on a
    // timer: a retry loop against a GPU that just failed is how a slow device
    // becomes an unusable one.
    setFailure((current) => current ?? reason);
  }, []);

  // "Not yet" and "failed" are different states and do not share a flag: one
  // resolves on its own, the other never does.
  const resolved = resolveEnvironmentMode({
    tier,
    webgl,
    canvas2d,
    disabled: Boolean(failure),
  });
  const mode: EnvironmentMode = ready ? resolved : "none";

  return { mode, tier, motion, resolved: ready, fail, failure };
}
