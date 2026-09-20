"use client";

import { usePathname } from "next/navigation";
import { contractIndexBySlug } from "@/data/contract-index";
import { LEVEL_NAME, levelIndex, routeForPath } from "@/data/routes";
import type { RouteMeta, StratumId } from "@/data/types";

export interface RouteContext {
  pathname: string;
  route: RouteMeta | undefined;
  level: StratumId;
  /** "00".."03". */
  index: string;
  /** "Interface". */
  levelName: string;
  /** In-world name for the current place. */
  display: string;
  /** Plain name for the current place. Always the accessible one. */
  conventional: string;
  /** "CONTRACT 02" when inside a contract, otherwise undefined. */
  designation?: string;
}

/**
 * Resolves where the visitor currently is, once.
 *
 * The chrome needs the current level, the current labels and — inside a
 * contract — that contract's designation. Every piece of chrome could
 * subscribe to the pathname itself, but then the status bar, the rail and the
 * mobile bar would each hold a subscription and each recompute the same
 * answer. One hook at the top, passed down as props, is cheaper and cannot go
 * inconsistent.
 *
 * A contract page takes its level from the contract rather than from the route
 * table, because contracts genuinely sit at different depths: deadlockd is
 * substrate work, the other two are engine work.
 */
export function useRouteContext(): RouteContext {
  const pathname = usePathname();
  const route = routeForPath(pathname);

  const slug = pathname.startsWith("/contracts/")
    ? pathname.slice("/contracts/".length).split("/")[0]
    : undefined;
  const contract = slug ? contractIndexBySlug(slug) : undefined;

  const level: StratumId = contract?.level ?? route?.level ?? "surface";

  return {
    pathname,
    route,
    level,
    index: levelIndex(level),
    levelName: LEVEL_NAME[level],
    display: contract?.designation ?? route?.display ?? "SIGNAL",
    conventional: contract?.name ?? route?.conventional ?? "home",
    designation: contract?.designation,
  };
}
