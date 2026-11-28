import { openingExtent } from "../../shared/geometry/opening.js";
import { centroid, convexOverlap, distanceToOutline, polygonProblems } from "../../shared/geometry/polygon.js";
import { furnishingFootprint } from "../../shared/geometry/furnishing.js";
import { railingRun } from "../../shared/geometry/railing.js";
import { flightDirection, flightRun, winderFrame } from "../../shared/geometry/stair.js";
import { wallLength, wallSegmentFootprint, wallTopMin } from "../../shared/geometry/wall.js";
import { cross, dot, perpLeft, toVec, vadd, vscale, vsub, type Vec } from "../../shared/geometry/vec.js";
import { idNodes } from "../../shared/schema/ids.js";
import type {
  BuildingModel,
  Opening,
  Polygon,
  Stair,
  StairFlight,
  StairWinder,
  Storey,
  Wall,
} from "../../shared/schema/schema.js";
import { checkComponents } from "./components.js";
import type { Issue } from "./issue.js";

const isComponent = (kind: string): boolean => kind === "door component" || kind === "window component";

/** Ids are the GlobalId keyspace: a duplicate anywhere in the model would collide in IFC. */
export function checkIds(model: BuildingModel): Issue[] {
  const issues: Issue[] = [];
  const seen = new Map<string, string>();
  for (const {
    kind,
    element: { id },
  } of idNodes(model)) {
    const first = seen.get(id);
    if (first === undefined) {
      seen.set(id, kind);
      continue;
    }
    const message =
      isComponent(first) && isComponent(kind)
        ? "component id is used twice"
        : first === kind
          ? `id is used by two ${kind}s`
          : `id is used by a ${first} and a ${kind}`;
    issues.push({ level: "ERROR", id, message });
  }
  return issues;
}

export function checkRailings(model: BuildingModel): Issue[] {
  const issues: Issue[] = [];
  for (const storey of model.storeys) {
    for (const r of storey.railings ?? []) {
      if (railingRun(r) === 0)
        issues.push({ level: "ERROR", id: r.id, message: "zero-length railing cannot be written to IFC" });
    }
  }
  return issues;
}

/** A furnishing may touch a wall but not stand in it: its footprint must not overlap a wall body on its storey. */
export function checkFurnishings(model: BuildingModel): Issue[] {
  const issues: Issue[] = [];
  for (const storey of model.storeys) {
    const bodies = storey.walls
      .filter((w) => wallLength(w) > 0)
      .map((w) => ({ id: w.id, body: wallSegmentFootprint(w, 0, wallLength(w)) }));
    for (const f of storey.furnishings ?? []) {
      const footprint = furnishingFootprint(f);
      for (const { id, body } of bodies)
        if (convexOverlap(footprint, body))
          issues.push({ level: "ERROR", id: f.id, message: `${f.kind} overlaps the body of ${id}` });
    }
  }
  return issues;
}

export function checkWalls(model: BuildingModel): Issue[] {
  const issues: Issue[] = [];
  const tolerance = 1e-6; // mm; wall lengths are square roots of integer coordinates
  for (const storey of model.storeys) {
    for (const w of storey.walls) {
      const length = wallLength(w);
      if (length === 0) issues.push({ level: "ERROR", id: w.id, message: "zero-length wall cannot be written to IFC" });
      if (w.profile) {
        const first = w.profile[0]!.along;
        const last = w.profile[w.profile.length - 1]!.along;
        if (Math.abs(first) > tolerance || Math.abs(last - length) > tolerance) {
          issues.push({ level: "ERROR", id: w.id, message: "profile must span the wall from along 0 to its length" });
        }
      }
    }
  }
  return issues;
}

/** Openings must sit wholly inside a wall on their own storey, and two openings may not cut the same volume. */
export function checkOpenings(model: BuildingModel): Issue[] {
  const issues: Issue[] = [];
  const tolerance = 1e-6; // mm; wall lengths are square roots of integer coordinates
  for (const storey of model.storeys) {
    const walls = new Map(storey.walls.map((w) => [w.id, w]));
    const hosted = new Map<string, { opening: Opening; wall: Wall; faces: [number, number][] }>();
    for (const opening of storey.openings) {
      if (opening.kind === "door" && opening.doorway && (opening.componentId || opening.swing)) {
        issues.push({ level: "ERROR", id: opening.id, message: "a doorway has no component or swing" });
      }
      const wall = walls.get(opening.wallId);
      if (!wall) {
        issues.push({
          level: "ERROR",
          id: opening.id,
          message: `wallId ${opening.wallId} is not a wall on this storey`,
        });
        continue;
      }
      const length = wallLength(wall);
      if (length === 0) continue; // reported by checkWalls
      // A splayed reveal is widest at its face, so that is where it must still fit.
      const faces = (["left", "right"] as const).map((face) => openingExtent(wall, opening, face));
      hosted.set(opening.id, { opening, wall, faces });
      const pastStart = Math.max(...faces.map(([from]) => -from));
      if (pastStart > tolerance)
        issues.push({
          level: "ERROR",
          id: opening.id,
          message: `opening is ${Math.round(pastStart)} mm past the wall start`,
        });
      const pastEnd = Math.max(...faces.map(([, to]) => to - length));
      if (pastEnd > tolerance)
        issues.push({
          level: "ERROR",
          id: opening.id,
          message: `opening is ${Math.round(pastEnd)} mm past the wall end`,
        });
      const aboveTop =
        opening.sillHeight +
        opening.height -
        wallTopMin(wall, opening.offsetAlongWall, opening.offsetAlongWall + opening.width);
      if (aboveTop > tolerance)
        issues.push({
          level: "ERROR",
          id: opening.id,
          message: `opening is ${Math.round(aboveTop)} mm above the wall top`,
        });
    }
    const list = [...hosted.values()];
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]!;
        if (a.opening.wallId !== b.opening.wallId) continue;
        // Outlines only widen towards a face, so two that meet anywhere in one half of the wall meet at its face.
        const along = a.faces.some(([a0, a1], i) => {
          const [b0, b1] = b.faces[i]!;
          return a0 < b1 - tolerance && b0 < a1 - tolerance;
        });
        const up =
          a.opening.sillHeight < b.opening.sillHeight + b.opening.height &&
          b.opening.sillHeight < a.opening.sillHeight + a.opening.height;
        if (!along || !up) continue;
        issues.push({ level: "ERROR", id: a.opening.id, message: `opening overlaps ${b.opening.id}` });
        issues.push({ level: "ERROR", id: b.opening.id, message: `opening overlaps ${a.opening.id}` });
      }
    }
  }
  return issues;
}

/** Every outline-bearing element on a storey: rooms, slabs, stair landings and stair winders. */
function outlined(storey: Storey): { id: string; outline: Polygon }[] {
  return [
    ...storey.rooms,
    ...storey.slabs,
    ...(storey.stairs ?? []).flatMap((s) =>
      s.segments.flatMap((seg) => (seg.kind === "landing" || seg.kind === "winder" ? [seg] : [])),
    ),
  ];
}

export function checkOutlines(model: BuildingModel): Issue[] {
  const issues: Issue[] = [];
  for (const storey of model.storeys) {
    for (const element of outlined(storey)) {
      for (const problem of polygonProblems(element.outline))
        issues.push({ level: "ERROR", id: element.id, message: problem });
    }
    for (const room of storey.rooms) {
      if (!room.dimensionOutline) continue;
      for (const problem of polygonProblems(room.dimensionOutline))
        issues.push({ level: "ERROR", id: room.id, message: `dimension outline: ${problem}` });
    }
  }
  return issues;
}

/** The storey with the lowest elevation above this one, or null when it is the top storey. */
function nextStoreyUp(model: BuildingModel, storey: Storey): Storey | null {
  let best: Storey | null = null;
  for (const s of model.storeys) {
    if (s.elevation <= storey.elevation) continue;
    if (!best || s.elevation < best.elevation) best = s;
  }
  return best;
}

/** How far a point may be from a landing's boundary and still count as meeting it. */
const LANDING_TOLERANCE = 1; // mm; authored points are integer, derived levels are exact

/**
 * A stair must climb to the next storey up, alternate flight and landing starting with a flight,
 * run somewhere on every flight, and land each flight on the boundary of the landing after it. A
 * final landing is a top landing one riser below the storey above. Nothing here bounds the riser
 * height, which is why the target may not skip a storey.
 */
export function checkStairs(model: BuildingModel): Issue[] {
  const issues: Issue[] = [];
  const storeys = new Map(model.storeys.map((s) => [s.id, s]));
  for (const storey of model.storeys) {
    for (const stair of storey.stairs ?? []) {
      const target = storeys.get(stair.toStoreyId);
      if (!target)
        issues.push({
          level: "ERROR",
          id: stair.id,
          message: `toStoreyId ${stair.toStoreyId} is not a storey in the model`,
        });
      else if (target.id === storey.id)
        issues.push({
          level: "ERROR",
          id: stair.id,
          message: "toStoreyId is its own storey: a stair must climb to another one",
        });
      else if (target.elevation <= storey.elevation)
        issues.push({
          level: "ERROR",
          id: stair.id,
          message: `toStoreyId ${target.id} is at ${target.elevation} mm, not above ${storey.id} at ${storey.elevation} mm`,
        });
      else {
        const next = nextStoreyUp(model, storey);
        if (next && next.id !== target.id)
          issues.push({
            level: "ERROR",
            id: stair.id,
            message: `toStoreyId ${target.id} skips ${next.id}, the next storey up`,
          });
      }

      const kinds = stair.segments.map((s) => s.kind);
      if (kinds[0] === "landing")
        issues.push({
          level: "ERROR",
          id: stair.id,
          message: "the first segment is a landing: a stair must start with a flight or a winder",
        });
      for (let i = 1; i < kinds.length; i++) {
        if (kinds[i] === "landing" && kinds[i - 1] === "landing") {
          issues.push({
            level: "ERROR",
            id: stair.id,
            message: `${stair.segments[i]!.id} is a landing straight after ${stair.segments[i - 1]!.id}`,
          });
        }
      }
      for (const seg of stair.segments) {
        if (seg.kind === "flight" && flightRun(seg) === 0)
          issues.push({ level: "ERROR", id: stair.id, message: `flight ${seg.id} has no plan run` });
      }

      issues.push(...checkWinders(stair));

      stair.segments.forEach((seg, i) => {
        if (seg.kind !== "landing") return;
        const before = stair.segments[i - 1];
        const after = stair.segments[i + 1];
        const outline = seg.outline.map(toVec);
        const meetings: [Vec, string][] = [];
        if (before?.kind === "flight") meetings.push([toVec(before.end), `${before.id} ends`]);
        if (after?.kind === "flight") meetings.push([toVec(after.start), `${after.id} starts`]);
        for (const [point, what] of meetings) {
          const off = distanceToOutline(point, outline);
          if (off > LANDING_TOLERANCE) {
            issues.push({
              level: "ERROR",
              id: seg.id,
              message: `${what} ${Math.round(off)} mm away from this landing`,
            });
          }
        }
      });
    }
  }
  return issues;
}

/** Whether every turn of an outline is the same way and none is straight. Needs three or more points. */
function strictlyConvex(pts: readonly Vec[]): boolean {
  const n = pts.length;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const c = cross(vsub(pts[(i + 1) % n]!, pts[i]!), vsub(pts[(i + 2) % n]!, pts[(i + 1) % n]!));
    if (Math.abs(c) < 1e-9) return false;
    if (sign === 0) sign = Math.sign(c);
    else if (Math.sign(c) !== sign) return false;
  }
  return true;
}

/**
 * A winder must be the first segment and followed by a flight (a flight before it, or nothing after
 * it, leaves a riser line owned twice or by nobody). Its outline must be strictly convex and its pivot
 * and entry points of it, beside each other. The flight after it must start on its exit edge, as wide as
 * the edge at most, and run away from the winder. All errors are against the winder, or the stair for
 * its place in it. The outline's distinct points and crossings are checked with the other outlines.
 */
function checkWinders(stair: Stair): Issue[] {
  const issues: Issue[] = [];
  stair.segments.forEach((seg, i) => {
    if (seg.kind !== "winder") return;
    const err = (id: string, message: string): number => issues.push({ level: "ERROR", id, message });
    if (i > 0)
      err(stair.id, `${seg.id} is a winder after ${stair.segments[i - 1]!.id}: a winder must be the first segment`);
    const after = stair.segments[i + 1];
    if (after?.kind !== "flight")
      err(stair.id, `${seg.id} is not followed by a flight: a winder must be followed by one`);

    const outline = seg.outline.map(toVec);
    if (outline.length >= 3 && polygonProblems(outline).length === 0 && !strictlyConvex(outline))
      err(seg.id, "outline is not strictly convex: it has a reflex corner or three points in a line");
    const frame = winderFrame(seg);
    if (typeof frame === "string") return void err(seg.id, frame);
    if (after?.kind !== "flight" || flightRun(after) === 0) return;
    checkFlightMeetsWinder(seg, after, frame.pivot, frame.exit, outline, err);
  });
  return issues;
}

function checkFlightMeetsWinder(
  winder: StairWinder,
  flight: StairFlight,
  pivot: Vec,
  exit: Vec,
  outline: Vec[],
  err: (id: string, message: string) => number,
): void {
  const exitEdge = [pivot, exit];
  const start = toVec(flight.start);
  const d = flightDirection(flight);
  const half = vscale(perpLeft(d), flight.width / 2);
  const off = distanceToOutline(start, exitEdge);
  if (off > LANDING_TOLERANCE) err(winder.id, `${flight.id} starts ${Math.round(off)} mm from this winder's exit edge`);
  else if (
    Math.max(distanceToOutline(vadd(start, half), exitEdge), distanceToOutline(vsub(start, half), exitEdge)) >
    LANDING_TOLERANCE
  )
    err(winder.id, `${flight.id} is wider than this winder's exit edge, so its start edge runs past it`);
  else if (dot(d, vsub(centroid(outline), start)) >= 0) err(winder.id, `${flight.id} runs back into this winder`);
}

/** Every cross-element rule, run before any output is written. */
export const checkModel = (model: BuildingModel): Issue[] => [
  ...checkComponents(model),
  ...checkIds(model),
  ...checkWalls(model),
  ...checkRailings(model),
  ...checkFurnishings(model),
  ...checkOpenings(model),
  ...checkOutlines(model),
  ...checkStairs(model),
];
