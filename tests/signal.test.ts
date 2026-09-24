import { beforeEach, describe, expect, it } from "vitest";
import {
  ENTRY_BEATS,
  ENTRY_LEVEL,
  entryDuration,
  entryLength,
  entryShot,
  sampleEntry,
  type EntryBeat,
} from "@/lib/environment/entry";
import { cameraTargetForLevel } from "@/lib/environment/camera";
import {
  beginSignal,
  countLandingVisit,
  endSignal,
  noteBeat,
  resetSignal,
  signalStore,
} from "@/components/landing/signal-store";

/**
 * The landing.
 *
 * The opening is the one part of this site that a visitor cannot re-run at
 * will, which makes it the part most likely to break without anybody
 * noticing. So the sequence is data and a pure sampler, and everything worth
 * asserting about it is asserted here: that it is monotonic, that it lands
 * exactly where the route camera expects to find the camera, that every move
 * is reachable, and that the three cases which must *not* get a cinematic
 * never do.
 *
 * None of this replaces looking at it. What it does is stop a fix from
 * silently coming undone — the same contract the environment suites hold.
 */

const TIERS = ["high", "balanced", "low"] as const;

/* ------------------------------------------------------------- the shot --- */

describe("the opening shot is authored, not improvised", () => {
  it("is composed on the surface, where the landmark stands", () => {
    expect(ENTRY_LEVEL).toBe("surface");
  });

  it("advances monotonically in time", () => {
    for (const length of ["full", "short"] as const) {
      const shot = entryShot(length);
      expect(shot.length).toBeGreaterThan(1);
      for (let i = 1; i < shot.length; i += 1) {
        expect(shot[i]!.at, `${length} keyframe ${i}`).toBeGreaterThan(shot[i - 1]!.at);
      }
      expect(shot[0]!.at).toBe(0);
    }
  });

  it("lands exactly on the camera's resting transform", () => {
    // The handoff. If the last keyframe is even slightly off the transform the
    // route camera would have chosen, the cinematic ends with a jump — which
    // is the one thing a five-second reveal cannot afford at its final frame.
    const rest = cameraTargetForLevel("surface");
    for (const length of ["full", "short"] as const) {
      const shot = entryShot(length);
      const last = shot[shot.length - 1]!;
      expect(last.position).toEqual(rest.position);
      expect(last.lookAt).toEqual(rest.lookAt);
      expect(last.fov).toBe(rest.fov);
      expect(last.beat).toBe("subject");
    }
  });

  it("reveals in the authored order, and reaches every move", () => {
    // Foreground, then the street, then what crosses it, then the depth of the
    // place, then the one building larger than the rest, then the subject.
    // A keyframe names the move that begins at it, and the last two both
    // begin the settle — so the sequence of *distinct* moves is what the
    // authored order refers to.
    const beats = entryShot("full").map((k) => k.beat);
    const distinct = beats.filter((b, i) => b !== beats[i - 1]);
    expect(distinct).toEqual(ENTRY_BEATS);

    // And each one is actually reachable by sampling — a keyframe nobody's
    // clock ever lands on is a move that does not exist.
    const seen = new Set<EntryBeat>();
    const total = entryDuration("full");
    for (let t = 0; t <= total + 16; t += 16) {
      const s = sampleEntry(entryShot("full"), t);
      if (s) seen.add(s.beat);
    }
    expect([...seen].sort()).toEqual([...ENTRY_BEATS].sort());
  });

  it("runs long enough to establish a world and short enough to respect a visitor", () => {
    expect(entryDuration("full")).toBeGreaterThanOrEqual(3000);
    expect(entryDuration("full")).toBeLessThanOrEqual(6000);
    // The short form exists because BALANCED renders the city with less
    // headroom, and because nobody should watch the long one twice.
    expect(entryDuration("short")).toBeLessThan(entryDuration("full") / 1.8);
    expect(entryDuration("none")).toBe(0);
  });

  it("is deterministic: the same elapsed time is always the same frame", () => {
    const shot = entryShot("full");
    for (const t of [0, 400, 1050, 2600, 4200, 5049]) {
      expect(sampleEntry(shot, t)).toEqual(sampleEntry(shot, t));
    }
  });

  it("stays finite, and clamps rather than extrapolating past the end", () => {
    const shot = entryShot("full");
    const total = entryDuration("full");
    for (let t = -500; t <= total + 4000; t += 97) {
      const s = sampleEntry(shot, t);
      expect(s).not.toBeNull();
      for (const v of [...s!.position, ...s!.lookAt, s!.fov]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      expect(s!.fov).toBeGreaterThan(20);
      expect(s!.fov).toBeLessThan(90);
    }
    const rest = cameraTargetForLevel("surface");
    const after = sampleEntry(shot, total + 10_000)!;
    expect(after.done).toBe(true);
    expect(after.position).toEqual(rest.position);
  });

  it("moves without spinning, shaking or leaving the street", () => {
    // Every sample stands on the surface level at a believable eye height and
    // inside the shaft the generator keeps clear. A camera that leaves the
    // room it is describing is a drone shot, which this deliberately is not.
    const shot = entryShot("full");
    let previous = sampleEntry(shot, 0)!;
    for (let t = 16; t <= entryDuration("full"); t += 16) {
      const s = sampleEntry(shot, t)!;
      expect(s.position[1]).toBeGreaterThan(0.5);
      expect(s.position[1]).toBeLessThan(12);
      expect(Math.hypot(s.position[0], s.position[2])).toBeLessThan(40);
      // No teleports: a frame never moves the camera more than a stride.
      const step = Math.hypot(
        s.position[0] - previous.position[0],
        s.position[1] - previous.position[1],
        s.position[2] - previous.position[2],
      );
      expect(step, `jump at ${t}ms`).toBeLessThan(0.9);
      previous = s;
    }
  });

  it("samples nothing when there is no shot", () => {
    expect(sampleEntry(entryShot("none"), 0)).toBeNull();
    expect(entryShot("none")).toHaveLength(0);
  });
});

/* -------------------------------------------------------- who gets one --- */

describe("who gets an opening, and who does not", () => {
  const base = {
    reducedMotion: false,
    seen: false,
    internal: false,
    tier: "high" as const,
    webgl: true,
  };

  it("gives a first-time visitor on capable hardware the full shot", () => {
    expect(entryLength(base)).toBe("full");
  });

  it("gives reduced motion nothing at all", () => {
    // Not "the same thing, faster". Someone who asked for less movement asked
    // for less movement.
    expect(entryLength({ ...base, reducedMotion: true })).toBe("none");
  });

  it("gives a returning visitor the short form, and an internal return nothing", () => {
    expect(entryLength({ ...base, seen: true })).toBe("short");
    // They never left the world; replaying its introduction would be telling
    // them where they already are.
    expect(entryLength({ ...base, seen: true, internal: true })).toBe("none");
  });

  it("never runs a camera the device is not rendering a city with", () => {
    expect(entryLength({ ...base, webgl: false })).toBe("none");
    expect(entryLength({ ...base, tier: "low" })).toBe("none");
    // A phone resolves to LOW and never starts a WebGL context, so both
    // guards hold independently.
    expect(entryLength({ ...base, tier: "low", webgl: false })).toBe("none");
  });

  it("shortens the shot on the tier that renders the city with less headroom", () => {
    expect(entryLength({ ...base, tier: "balanced" })).toBe("short");
  });

  it("returns a length the shot table knows about, for every combination", () => {
    for (const reducedMotion of [true, false]) {
      for (const seen of [true, false]) {
        for (const internal of [true, false]) {
          for (const tier of TIERS) {
            for (const webgl of [true, false]) {
              const length = entryLength({ reducedMotion, seen, internal, tier, webgl });
              expect(["full", "short", "none"]).toContain(length);
              expect(entryDuration(length)).toBeGreaterThanOrEqual(0);
            }
          }
        }
      }
    }
  });
});

/* ------------------------------------------------------- the state machine --- */

describe("the landing state machine", () => {
  beforeEach(() => resetSignal());

  it("starts, and ends up, in the complete page", () => {
    // `ready` is the default and the server snapshot, not a reward: the markup
    // a crawler or a reader without JavaScript receives is the finished
    // landing.
    expect(signalStore.getServerSnapshot().phase).toBe("ready");
    expect(signalStore.getSnapshot().phase).toBe("ready");
  });

  it("resolves immediately when there is no opening", () => {
    beginSignal("none");
    expect(signalStore.getSnapshot().phase).toBe("ready");
  });

  it("walks the phases in order as the camera reports its moves", () => {
    beginSignal("full");
    expect(signalStore.getSnapshot().phase).toBe("signal");

    const phases: string[] = [];
    for (const beat of ENTRY_BEATS) {
      noteBeat(beat);
      phases.push(signalStore.getSnapshot().phase);
    }
    expect(phases).toEqual(["wake", "reveal", "reveal", "reveal", "reveal", "subject"]);

    endSignal();
    expect(signalStore.getSnapshot().phase).toBe("ready");
  });

  it("hands the subject over before the camera stops, not after", () => {
    beginSignal("full");
    noteBeat("subject");
    // The heading settles while the camera is still easing into rest. Waiting
    // for `endSignal` would read as two events instead of one.
    expect(signalStore.getSnapshot().phase).toBe("subject");
  });

  it("notifies subscribers on every real change and on nothing else", () => {
    let calls = 0;
    const stop = signalStore.subscribe(() => (calls += 1));
    beginSignal("full");
    noteBeat("wake");
    noteBeat("wake");
    noteBeat("street");
    endSignal();
    stop();
    // begin, wake, street, end. The repeated beat is not a change.
    expect(calls).toBe(4);
  });

  it("counts arrivals so a return through the site is instant", () => {
    // Zero means this page load *is* the arrival. A module counter survives a
    // client-side route change and a full reload resets it, which is exactly
    // the distinction the Navigation Timing API cannot make.
    expect(countLandingVisit()).toBe(0);
    expect(countLandingVisit()).toBe(1);
    expect(countLandingVisit()).toBe(2);
  });
});
