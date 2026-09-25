"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMotionAllowed } from "@/components/providers/MotionProvider";
import { LEVEL_NAME, LEVEL_ORDER, levelIndex, route, routeForLevel } from "@/data/routes";
import type { StratumId } from "@/data/types";
import { QUALITY, type QualityTier } from "@/lib/capability";
import { generateCity } from "@/lib/environment/generate";
import {
  ENVIRONMENT_BUDGET,
  type EnvironmentMode,
} from "@/lib/environment/quality";

const CityScene = dynamic(() => import("./CityScene"), { ssr: false });
const CanvasAtmosphere = dynamic(() => import("./CanvasAtmosphere"), { ssr: false });

const TIERS: QualityTier[] = ["high", "balanced", "low"];
const MODES: EnvironmentMode[] = ["webgl", "canvas", "css", "none"];

/**
 * The environment laboratory.
 *
 * `/system` is internal: noindex, not in navigation, reviewed rather than read.
 * Its job is to make things inspectable that are otherwise only observable by
 * chance — a tier you do not have the hardware to trigger, a fallback you
 * cannot reach without disabling WebGL, a level whose only route is one the
 * environment stands down on.
 *
 * That last one is not hypothetical. The surface level is the richest of the
 * four and its only route is `/`, where this layer defers to the existing
 * descent scene — so without this page, the surface city could not be looked
 * at at all before Phase 6.
 *
 * One canvas, switched, rather than a grid of previews. Four live WebGL
 * contexts on one page to compare four levels would be a demonstration of
 * exactly the carelessness this phase is supposed to avoid.
 */
export function EnvironmentLab() {
  const deviceMotion = useMotionAllowed();
  /*
   * The controls are addressable by URL, and the URL is the *default* rather
   * than a second source of truth.
   *
   * `/system?level=engine&tier=balanced&mode=webgl&wide=1` opens on that
   * state. Two reasons, and the second is what made it necessary:
   *
   *  - a review you can link to is a review someone else can repeat, which is
   *    the entire premise of this page;
   *  - switching tier in a live page tears down a WebGL context and builds
   *    another, and on the software rasteriser the visual QA harness runs on
   *    the second context frequently never arrived. Every non-default tier
   *    came back reading "renderer stepped down: WebGL context lost".
   *    Arriving in the state wanted, with one context, is not a workaround
   *    for that — it is how a reader would reach it too.
   *
   * Held as `null` until someone clicks, and resolved against the query
   * string during render. A `useEffect` that copied the URL into state would
   * have been the obvious shape and the wrong one: it is a second copy of a
   * value that already exists, updated one render late.
   */
  const params = useSearchParams();
  const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T =>
    allowed.find((a) => a === params.get(key)) ?? fallback;

  const [levelChoice, setLevel] = useState<StratumId | null>(null);
  const [tierChoice, setTier] = useState<QualityTier | null>(null);
  const [modeChoice, setMode] = useState<EnvironmentMode | null>(null);
  const [motionChoice, setMotion] = useState<boolean | null>(null);
  const [wideChoice, setWide] = useState<boolean | null>(null);
  const [failure, setFailure] = useState<string | undefined>();

  const level = levelChoice ?? pick("level", LEVEL_ORDER, "surface");
  const tier = tierChoice ?? pick("tier", TIERS, "high");
  const mode = modeChoice ?? pick("mode", MODES, "webgl");
  const motion = motionChoice ?? params.get("motion") !== "0";
  const wide = wideChoice ?? params.get("wide") === "1";

  // Escape leaves the full-bleed view. A viewer that fills the screen and can
  // only be dismissed by finding a small button again is a trap.
  useEffect(() => {
    if (!wide) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWide(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wide]);

  const city = useMemo(() => generateCity(tier), [tier]);
  const budget = ENVIRONMENT_BUDGET[tier];
  const animating = motion && deviceMotion && budget.rain > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <Control label="Level">
          {LEVEL_ORDER.map((id) => (
            <Choice key={id} active={level === id} onClick={() => setLevel(id)}>
              {levelIndex(id)} {LEVEL_NAME[id]}
            </Choice>
          ))}
        </Control>

        <Control label="Quality tier">
          {TIERS.map((id) => (
            <Choice
              key={id}
              active={tier === id}
              onClick={() => {
                setTier(id);
                setFailure(undefined);
              }}
            >
              {id}
            </Choice>
          ))}
        </Control>

        <Control label="Render mode">
          {MODES.map((id) => (
            <Choice key={id} active={mode === id} onClick={() => setMode(id)}>
              {id}
            </Choice>
          ))}
        </Control>

        <Control label="Motion">
          <Choice active={motion} onClick={() => setMotion(true)}>
            full
          </Choice>
          <Choice active={!motion} onClick={() => setMotion(false)}>
            reduced
          </Choice>
        </Control>

        <Control label="View">
          <Choice active={wide} onClick={() => setWide((v) => !v)}>
            {wide ? "exit full bleed — esc" : "full bleed"}
          </Choice>
        </Control>
      </div>

      {/* The stage.

          Full bleed matters for review rather than for show: a city judged in
          a 400-pixel strip is a city nobody has actually looked at, and
          composition, atmospheric depth and the read of the skyline only
          resolve at something like the size a visitor will see. `key` on the
          tier is deliberate — changing tier tears the renderer down and builds
          a new one, which is the lifecycle this page exists to exercise. */}
      <div
        className={
          wide
            ? "fixed inset-0 z-[var(--z-overlay)] overflow-hidden bg-[var(--deep)]"
            : "relative h-[34rem] overflow-hidden border border-[var(--hair)] bg-[var(--deep)]"
        }
      >
        <div className="env-base absolute inset-0" />

        {mode === "webgl" && !failure && (
          <CityScene
            key={`${tier}-${QUALITY[tier].maxDpr}`}
            tier={tier}
            level={level}
            // The laboratory looks at a level, so it faces that level's own
            // primary destination — the same shot the site gives it.
            routeId={routeForLevel(level).id}
            motion={motion && deviceMotion}
            onFail={setFailure}
            className="env-canvas"
          />
        )}

        {mode === "canvas" && (
          <CanvasAtmosphere tier={tier} level={level} className="env-canvas" />
        )}

        {failure && (
          <p className="absolute inset-x-0 bottom-0 p-3 t-mono text-[0.75rem] text-[var(--state-unsafe)]">
            renderer stepped down: {failure}
          </p>
        )}
      </div>

      {/* Measured, never asserted. Every number below is read off the generated
          model or the tier contract — there is no hand-written figure here. */}
      <dl className="grid grid-cols-2 gap-x-8 gap-y-2 t-mono text-[0.75rem] sm:grid-cols-4">
        <Stat label="seed" value={city.seed} />
        <Stat label="structures" value={String(city.stats.structures)} />
        <Stat label="kit pieces" value={String(city.stats.parts)} />
        <Stat label="lit cells" value={String(city.stats.lights)} />
        <Stat label="conduits" value={String(city.stats.conduits)} />
        <Stat label="anchors" value={String(city.stats.anchors)} />
        <Stat label="draw calls" value={String(city.stats.drawCalls)} />
        <Stat label="rain" value={animating ? String(budget.rain) : "off"} />
        <Stat label="frameloop" value={animating ? "always" : "demand"} />
        <Stat label="webgl permitted" value={QUALITY[tier].webgl ? "yes" : "no"} />
        <Stat label="max dpr" value={String(QUALITY[tier].maxDpr)} />
      </dl>

      <table className="w-full t-mono text-[0.75rem]">
        <caption className="mb-3 text-left text-[var(--fg-low)]">
          Per level. Structure and light counts are distributed by authored
          share, not split evenly — density is character.
        </caption>
        <thead>
          <tr className="text-left text-[var(--fg-low)]">
            <th className="py-1 pr-4 font-normal">level</th>
            <th className="py-1 pr-4 font-normal">floor</th>
            <th className="py-1 pr-4 font-normal">structures</th>
            <th className="py-1 pr-4 font-normal">set pieces</th>
            <th className="py-1 pr-4 font-normal">lit cells</th>
            <th className="py-1 pr-4 font-normal">anchors</th>
          </tr>
        </thead>
        <tbody>
          {city.levels.map((l) => (
            <tr key={l.level} className="border-t border-[var(--hair-faint)]">
              <td className="py-1 pr-4 text-[var(--fg-hi)]">
                {l.index} {l.level}
              </td>
              <td className="py-1 pr-4">{l.floor}</td>
              <td className="py-1 pr-4">{l.structures.length}</td>
              <td className="py-1 pr-4">{l.fixtures.length}</td>
              <td className="py-1 pr-4">{l.lights.length}</td>
              <td className="py-1 pr-4">{l.anchors.length}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="w-full t-mono text-[0.75rem]">
        <caption className="mb-3 text-left text-[var(--fg-low)]">
          Navigation anchors. Each carries a route id, never a path — the
          destination is resolved through the route table at read time.
        </caption>
        <thead>
          <tr className="text-left text-[var(--fg-low)]">
            <th className="py-1 pr-4 font-normal">anchor</th>
            <th className="py-1 pr-4 font-normal">kind</th>
            <th className="py-1 pr-4 font-normal">route id</th>
            <th className="py-1 pr-4 font-normal">resolves to</th>
            <th className="py-1 pr-4 font-normal">level</th>
          </tr>
        </thead>
        <tbody>
          {city.levels.flatMap((l) =>
            l.anchors.map((a) => (
              <tr key={a.id} className="border-t border-[var(--hair-faint)]">
                <td className="py-1 pr-4 text-[var(--fg-hi)]">{a.id}</td>
                <td className="py-1 pr-4">{a.kind}</td>
                <td className="py-1 pr-4 text-[var(--cold)]">{a.routeId}</td>
                <td className="py-1 pr-4">{route(a.routeId).path}</td>
                <td className="py-1 pr-4">{a.level}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="system-label mb-2">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="min-h-11 border px-3 py-1 t-mono text-[0.75rem] uppercase"
      style={{
        borderColor: active ? "var(--accent)" : "var(--hair)",
        color: active ? "var(--accent)" : "var(--fg-mid)",
      }}
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[var(--hair-faint)] py-1">
      <dt className="text-[var(--fg-low)]">{label}</dt>
      <dd className="text-[var(--fg-hi)]">{value}</dd>
    </div>
  );
}
