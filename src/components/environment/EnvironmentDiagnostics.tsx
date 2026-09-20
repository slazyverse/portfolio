"use client";

import { useEffect, useState } from "react";
import type { StratumId } from "@/data/types";
import type { QualityTier } from "@/lib/capability";
import { generateCity } from "@/lib/environment/generate";
import type { EnvironmentMode } from "@/lib/environment/quality";
import { environmentBudget } from "@/lib/environment/quality";

/**
 * Development-only environment readout.
 *
 * Two rules, and the second one is the important one:
 *
 *  1. It is compiled out of production. The guard is a literal
 *     `process.env.NODE_ENV` comparison, which the bundler folds to `false`
 *     and eliminates — this component contributes nothing to a production
 *     bundle, not even a conditional.
 *
 *  2. **Every value here is measured.** Nothing is invented to make the panel
 *     look richer. This site's entire premise is that anything resembling data
 *     is data, and a development tool is not an exemption — a fabricated draw
 *     count would be exactly as dishonest here as a fabricated metric on a
 *     project page, and rather more likely to be believed, because it would be
 *     believed by me.
 *
 * `Ctrl+Alt+D` toggles it. Off by default, so it never gets in the way of
 * looking at the thing it describes.
 */
export default function EnvironmentDiagnostics({
  mode,
  tier,
  motion,
  level,
  failure,
  suppressed,
}: {
  mode: EnvironmentMode;
  tier: QualityTier;
  motion: boolean;
  level: StratumId;
  failure?: string;
  suppressed?: string;
}) {
  const enabled = process.env.NODE_ENV !== "production";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  if (!enabled || !open) return null;

  const budget = environmentBudget(tier);
  // Regenerated here rather than threaded down from the renderer. The
  // generator is pure and seeded, so this is the same city the renderer drew —
  // and if it ever were not, that would be a determinism bug worth seeing.
  const city = generateCity(tier);
  const rows: [string, string][] = [
    ["mode", mode],
    ["tier", tier],
    ["motion", motion ? "full" : "reduced"],
    ["level", level],
    ["seed", city.seed],
    ["structures", String(city.stats.structures)],
    ["lit cells", String(city.stats.lights)],
    ["conduits", String(city.stats.conduits)],
    ["anchors", String(city.stats.anchors)],
    ["draw calls", String(city.stats.drawCalls)],
    ["rain", budget.rain > 0 && motion ? String(budget.rain) : "off"],
    ["frameloop", budget.rain > 0 && motion ? "always" : "demand"],
    // Read at render rather than held in state: the panel only renders after
    // a keypress, so `window` is necessarily available, and a device pixel
    // ratio kept in state would be a stale copy of a value that changes when
    // the window moves between displays.
    ["device pixel ratio", window.devicePixelRatio.toFixed(2)],
  ];
  if (suppressed) rows.push(["suppressed", suppressed]);
  if (failure) rows.push(["failure", failure]);

  return (
    <div className="env-diagnostics">
      <p className="env-diagnostics-title">environment // dev</p>
      <dl>
        {rows.map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
