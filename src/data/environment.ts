import type { AnchorKind } from "@/lib/environment/types";
import type { RouteId } from "./types";

/**
 * The authored navigation anchors.
 *
 * Not every object in the city is a destination. Making all of them clickable
 * would produce a world where everything is slightly interactive and nothing
 * is meaningful — and it would make the reader hunt. These eight are authored,
 * they are the only ones that will ever map to a route, and the rest of the
 * city is scenery.
 *
 * Two rules hold this to the route table:
 *
 *  1. An anchor declares a `routeId`, never a path. Paths are the route
 *     table's business; `/contracts` could become `/work` tomorrow and nothing
 *     in the environment would need to know.
 *
 *  2. An anchor does not declare a level. The route already has one, and a
 *     second copy is a second thing to keep in sync — which is exactly the
 *     class of bug Phase 4 found between the status bar and the page header.
 *
 * `kind` is in-world vocabulary because the environment is a register of its
 * own. The mapping from an in-world noun to a destination is authored here and
 * inferred nowhere.
 */
export interface AnchorSpec {
  id: string;
  kind: AnchorKind;
  routeId: RouteId;
  importance: "primary" | "secondary";
  /**
   * Where the anchor sits, as a signed offset in turns from the direction its
   * level's camera faces. Zero is dead ahead; roughly ±0.12 is the edge of a
   * comfortable frame.
   *
   * Relative rather than absolute, and that is a correction. These were
   * compass bearings for four phases, which was harmless while nothing drew
   * them — the anchors sat correctly around a circle and every single one was
   * behind the only camera in the world. Authored rather than generated so a
   * landmark keeps its place when the seed changes: the city may be
   * reshuffled, but the tower stays where you left it.
   */
  bearing: number;
}

export const ANCHOR_SPECS: readonly AnchorSpec[] = [
  // 00 SURFACE — identity and entry.
  {
    id: "beacon",
    kind: "communication-tower",
    routeId: "signal",
    importance: "primary",
    bearing: -0.02,
  },

  // 01 INTERFACE — where behaviour becomes visible.
  {
    id: "terminal",
    kind: "terminal",
    routeId: "dossier",
    importance: "primary",
    bearing: -0.07,
  },
  {
    id: "node-array",
    kind: "network-node",
    routeId: "systems",
    importance: "secondary",
    bearing: 0.1,
  },

  // 02 ENGINE — where the work is done.
  {
    id: "contract-hub",
    kind: "contract-hub",
    routeId: "contracts",
    importance: "primary",
    bearing: 0.01,
  },

  // 03 SUBSTRATE — bedrock; facts, no ornament.
  {
    id: "core",
    kind: "infrastructure-core",
    routeId: "record",
    importance: "primary",
    bearing: -0.03,
  },
  {
    id: "archive",
    kind: "archive",
    routeId: "colophon",
    importance: "secondary",
    bearing: -0.11,
  },
  {
    id: "ledger",
    kind: "ledger",
    routeId: "verify",
    importance: "secondary",
    bearing: 0.08,
  },
  {
    id: "relay",
    kind: "relay",
    routeId: "contact",
    importance: "secondary",
    bearing: 0.12,
  },
] as const;

/**
 * The city's seed.
 *
 * Named rather than numeric so that changing it is a visible, reviewable edit
 * with a reason attached, and so the value in a screenshot caption means
 * something. Changing this string regenerates the entire city.
 */
export const CITY_SEED = "substrate/vertical-slice-01";
