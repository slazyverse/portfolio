import { CITY_GEOMETRY, TRANSIT } from "./generate";

/* ---------------------------------------------------------------------------
 * What is moving, and why it slows down where it does.
 *
 * The traffic was always one draw call of GPU-animated streaks, and the
 * arithmetic that positions them was always the interesting part — so it lives
 * here now rather than inside the component, imports no rendering library, and
 * is asserted in Node like everything else the world is built from.
 *
 * The change this phase makes is small and the effect is not. A vehicle's
 * slowdown used to be a free sine on its own fixed period: a train decelerated
 * every thirty-nine seconds having travelled between a ninth and a quarter of
 * the way round the ring, so it stopped constantly and never at the station it
 * was passing. Anchoring the brake to a *place* instead of a clock turns the
 * same one draw call into a service that arrives, slows, dwells and departs,
 * and turns street traffic into something that queues at junctions.
 * ------------------------------------------------------------------------- */

/** What a moving light is. */
export type VehicleKind = "train" | "service" | "street";

/** One vehicle, resolved before anything is uploaded. */
export interface Vehicle {
  kind: VehicleKind;
  radius: number;
  /** Signed angular rate in radians per second. The sign is the direction. */
  rate: number;
  /** The bearing the slowdown is centred on. */
  anchor: number;
  /** Where in its own cycle it starts. */
  offset: number;
  /** How deep the slowdown is, as a fraction of cruise. */
  brake: number;
  /** How many slowdowns there are per circuit. */
  brakeMul: number;
  /** Half-width of the arc it is drawn on. Past this it is not drawn. */
  sweep: number;
  height: number;
  /** Half-length of the streak, in metres. */
  length: number;
  thickness: number;
  /** A lamp, not a palette token. */
  colour: string;
}

/**
 * Headlights and tail lights, not design tokens.
 *
 * A vehicle coming towards you shows white and one going away shows red, and
 * that single fact is most of what makes a moving light read as a car rather
 * than as a decoration travelling along a line. A train is lit by its own
 * windows, so it is a long cool-white body. A service vehicle carries a
 * beacon, which is the one amber in this street allowed to be moving.
 */
export const VEHICLE_COLOUR = {
  head: "#fff0d6",
  tail: "#ff2f22",
  carriage: "#cfe4f2",
  beacon: "#ffa22e",
} as const;

/**
 * Seconds between arrivals at the platform, for a given traffic budget.
 *
 * Derived from how many trains the tier actually runs rather than from the
 * top-tier figure, because a tier with half the line has twice the wait —
 * and the platform's lighting and the people standing on it are both driven
 * from this number. Zero where there is no service at all, which is how a
 * level with no trains ends up with commuters on their own clocks instead of
 * waiting for something that never comes.
 */
export function arrivalInterval(count: number): number {
  const n = services(count);
  return n > 0 ? TRANSIT.period / n : 0;
}

/**
 * Where a vehicle is at a given moment, as an angle on its ring.
 *
 * Written as `u` minus a sine *of u*, so the minimum of the derivative falls
 * at u = 0 by construction — and at u = 0 the offset from the anchor is also
 * zero. The vehicle is therefore slowest exactly where its anchor is, every
 * circuit, with no phase to solve for. Point the anchor at the station and a
 * train cannot do anything but stop there.
 */
export function travelAt(v: Vehicle, t: number): number {
  const u = t * v.rate + v.offset;
  return u - v.brake * Math.sin(u * v.brakeMul);
}

/** The angle a vehicle is at, in world bearing. */
export function angleAt(v: Vehicle, t: number): number {
  return v.anchor + travelAt(v, t);
}

/**
 * How fast it is going, in radians per second, signed.
 *
 * Never crosses zero, which is the one hard constraint on the whole model: a
 * streak that reverses is not traffic. It holds as long as `brake * brakeMul`
 * stays below one, and that is asserted rather than assumed.
 */
export function rateAt(v: Vehicle, t: number): number {
  const u = t * v.rate + v.offset;
  return v.rate * (1 - v.brake * v.brakeMul * Math.cos(u * v.brakeMul));
}

/** How many trains and service vehicles a traffic budget buys. */
export function services(count: number): number {
  return Math.max(0, Math.min(TRANSIT.services, Math.round(count / 85)));
}

export function serviceVehicles(count: number): number {
  return count > 0 ? Math.max(1, Math.round(count / 48)) : 0;
}

/**
 * Everything moving on a level, as data.
 *
 * The budget split is the part worth stating. Trains are a *service* rather
 * than a share of the road: four is a line whatever else is driving, and the
 * tier reduces it because a tier reduces everything. Service vehicles are a
 * small fixed fraction. The street takes the remainder — which is why cutting
 * sixty-eight carriages down to four costs nothing at all, since the vertices
 * simply change lanes.
 */
export function fleet(count: number, floor: number, look: number): Vehicle[] {
  const out: Vehicle[] = [];
  if (count <= 0) return out;

  const trains = services(count);
  const carts = serviceVehicles(count);
  const street = Math.max(0, count - trains - carts);

  /* --- the line --------------------------------------------------------- */
  const lineRate = (Math.PI * 2) / TRANSIT.period;
  for (let k = 0; k < trains; k += 1) {
    out.push({
      kind: "train",
      radius: TRANSIT.radius + ((k % 2) - 0.5) * (TRANSIT.deck * 0.3),
      rate: lineRate,
      // The station. Everything else about a train follows from this.
      anchor: look,
      // Evenly spaced, so arrivals are evenly spaced: one every eighteen
      // seconds rather than four at once and then a long wait.
      offset: -(k / trains) * Math.PI * 2,
      /*
       * Down to a twelfth of line speed at the platform, and deliberately not
       * to zero.
       *
       * A vehicle that actually stops in a system with no timetable has to be
       * told when to leave, which is a state machine. One that never quite
       * stops reads as a train standing at a platform anyway: at this distance
       * the difference between stationary and creeping is invisible, and the
       * difference between stopping and not stopping is not.
       */
      brake: 0.92,
      brakeMul: 1,
      // The viaduct is a sweep of about ninety degrees centred on the station,
      // not a closed loop. Past its ends there is no track to be on.
      sweep: 0.86,
      height: floor + TRANSIT.height + 2.4,
      length: 7.5,
      thickness: 0.5,
      colour: VEHICLE_COLOUR.carriage,
    });
  }

  /* --- service vehicles -------------------------------------------------- */
  for (let k = 0; k < carts; k += 1) {
    const i = k * 7 + 3;
    /*
     * Slow, low, and anchored where the work is.
     *
     * A service vehicle is not going anywhere in particular — it is attending
     * to something — so its brake sits at its own bearing and it spends most
     * of its cycle crawling there. The same arithmetic that makes a train
     * dwell at a station makes a cart loiter at a loading bay, which is the
     * argument for having only one of it.
     */
    out.push({
      kind: "service",
      radius: CITY_GEOMETRY.VOID_RADIUS + 26 + ((i * 0.618) % 1) * 54,
      rate: ((Math.PI * 2) / 260) * (k % 2 === 0 ? 1 : -1),
      anchor: look + (((i * 0.3247) % 1) - 0.5) * 1.5,
      offset: -((k * 0.7548776662) % 1) * 0.9,
      brake: 0.95,
      brakeMul: 1,
      sweep: 9,
      height: floor + 1.1,
      length: 1.5,
      thickness: 0.34,
      colour: VEHICLE_COLOUR.beacon,
    });
  }

  /* --- the street -------------------------------------------------------- */
  for (let k = 0; k < street; k += 1) {
    const i = k + trains + carts;
    const lane = k % 4;
    const direction = lane % 2 === 0 ? 1 : -1;
    /*
     * Bunching at fixed bearings rather than at a fixed time.
     *
     * A lane's brake minima fall at evenly spaced angles around its ring, so
     * traffic slows at the same handful of places on every lap. That is what
     * a junction looks like from a distance, and it falls straight out of
     * anchoring the brake to a place — the previous version bunched on a
     * timer, which means it bunched wherever it happened to be.
     *
     * A different count per lane, so the lanes do not all queue together.
     */
    const brakeMul = 4 + lane;
    out.push({
      kind: "street",
      radius: CITY_GEOMETRY.VOID_RADIUS + 18 + lane * 21 + ((i * 0.618) % 1) * 12,
      rate: direction * (0.03 + ((i * 0.3247) % 1) * 0.045),
      anchor: 0,
      offset: (i * 2.399963) % (Math.PI * 2),
      // Kept under one over the multiplier, which is what stops a vehicle
      // running backwards. Asserted in the tests rather than trusted here.
      brake: (0.62 + ((i * 0.911) % 1) * 0.2) / brakeMul,
      brakeMul,
      sweep: 9,
      height: floor + 1.4 + lane * 0.7,
      length: 1.1 + ((i * 0.754) % 1) * 1.4,
      thickness: 0.3,
      colour: direction > 0 ? VEHICLE_COLOUR.head : VEHICLE_COLOUR.tail,
    });
  }

  return out;
}

/**
 * Whether a train is at the platform at a given moment.
 *
 * The one piece of transit *state* the rest of the world needs. The station's
 * lighting and the people waiting on it are driven from the same clock as the
 * train, which is the whole difference between a platform with people near it
 * and a platform being used.
 *
 * Returns 0 at the moment a train is at rest and climbs to 1 just before the
 * next one.
 */
export function dwellPhase(t: number, count: number): number {
  const interval = arrivalInterval(count);
  if (interval <= 0) return 0;
  return (((t % interval) + interval) % interval) / interval;
}
