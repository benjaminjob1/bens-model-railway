// Pure helpers for the background train animation and the Train controls panel.
// Kept free of React and the DOM so they can be checked in Node.

export const MIN_TRAIN_SPEED = 0.5;
export const MAX_TRAIN_SPEED = 2;

/** Base progress per 60 fps frame. Later trains run slightly faster so they spread out. */
export function baseTrainSpeed(index: number) {
  return 0.00018 + index * 0.00007;
}

export function clampSpeed(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_TRAIN_SPEED, Math.max(MIN_TRAIN_SPEED, value));
}

/** Frame-rate correction: 1 at 60 fps, capped so a long gap (hidden tab, slow frame) never jumps a train. */
export function frameScaleFor(previous: number, now: number) {
  if (!previous || !(now > previous)) return 1;
  return Math.min(now - previous, 64) / (1000 / 60);
}

export interface TrainSetting { paused: boolean; speed: number }
export interface TrainControlState { allPaused: boolean; trains: TrainSetting[] }

export function freshTrains(count: number): TrainSetting[] {
  return Array.from({ length: Math.max(0, count) }, () => ({ paused: false, speed: 1 }));
}

export function isTrainMoving(state: TrainControlState, index: number) {
  return !state.allPaused && !state.trains[index]?.paused;
}

export function anyTrainMoving(state: TrainControlState) {
  return state.trains.some((_, i) => isTrainMoving(state, i));
}

export function pauseAll(state: TrainControlState): TrainControlState {
  return { ...state, allPaused: true };
}

/** Run all resumes everything, including trains that were paused individually. */
export function runAll(state: TrainControlState): TrainControlState {
  return { allPaused: false, trains: state.trains.map(t => ({ ...t, paused: false })) };
}

/** Toggle one train. Running a train while everything is paused starts only that train. */
export function toggleTrain(state: TrainControlState, index: number): TrainControlState {
  if (index < 0 || index >= state.trains.length) return state;
  if (isTrainMoving(state, index)) {
    return { ...state, trains: state.trains.map((t, i) => (i === index ? { ...t, paused: true } : t)) };
  }
  if (state.allPaused) {
    return { allPaused: false, trains: state.trains.map((t, i) => ({ ...t, paused: i !== index })) };
  }
  return { ...state, trains: state.trains.map((t, i) => (i === index ? { ...t, paused: false } : t)) };
}

export function setTrainSpeed(state: TrainControlState, index: number, value: number): TrainControlState {
  if (index < 0 || index >= state.trains.length) return state;
  return { ...state, trains: state.trains.map((t, i) => (i === index ? { ...t, speed: clampSpeed(value) } : t)) };
}

export function effectiveSpeed(globalSpeed: number, trainSpeed: number) {
  return clampSpeed(globalSpeed) * clampSpeed(trainSpeed);
}

/**
 * Advance every train once. Every train is handled by the same path, so the global and
 * per-train multipliers apply to all of them. `hold` is a train being dragged by hand.
 */
export function stepProgress(
  progress: number[],
  opts: { frameScale: number; globalSpeed: number; state: TrainControlState; reducedMotion?: boolean; hold?: number | null },
) {
  return progress.map((p, i) => {
    const start = Number.isFinite(p) ? p : 0;
    if (opts.reducedMotion || opts.hold === i || !isTrainMoving(opts.state, i)) return start;
    const per = opts.state.trains[i]?.speed ?? 1;
    const next = start + baseTrainSpeed(i) * opts.frameScale * effectiveSpeed(opts.globalSpeed, per);
    return ((next % 1) + 1) % 1;
  });
}

/**
 * The route a train runs: the main loop up to the junction with the branch, out along the
 * branch and back, then the rest of the loop. Positions are continuous at every joint, so a
 * train never jumps. A branch that does not touch the main loop is ignored.
 */
export interface Route { mainLength: number; branchLength: number; junction: number }

export function routeLength(route: Route) {
  return route.mainLength + 2 * route.branchLength;
}

export type RoutePoint = { path: 'main' | 'branch'; at: number };

export function locateOnRoute(route: Route, progress: number): RoutePoint {
  const total = routeLength(route);
  if (!(total > 0)) return { path: 'main', at: 0 };
  const p = ((progress % 1) + 1) % 1;
  let d = p * total;
  const { mainLength: L, branchLength: B, junction: J } = route;
  if (B <= 0) return { path: 'main', at: Math.min(d, L) };
  if (d <= J) return { path: 'main', at: d };
  d -= J;
  if (d <= B) return { path: 'branch', at: d };
  d -= B;
  if (d <= B) return { path: 'branch', at: B - d };
  d -= B;
  return { path: 'main', at: Math.min(L, J + d) };
}

/** Progress for a point on the main loop (distance along it) or on the branch (outbound leg). */
export function progressForRoutePoint(route: Route, point: RoutePoint) {
  const total = routeLength(route);
  if (!(total > 0)) return 0;
  const { branchLength: B, junction: J } = route;
  let d: number;
  if (point.path === 'branch') d = J + Math.max(0, Math.min(B, point.at));
  else d = B > 0 && point.at > J ? point.at + 2 * B : point.at;
  return (d / total) % 1;
}

/** Reconcile per-train settings with a new train count, keeping existing trains' settings. */
export function resizeTrains(trains: TrainSetting[], count: number) {
  return Array.from({ length: Math.max(0, count) }, (_, i) => trains[i] ?? { paused: false, speed: 1 });
}
