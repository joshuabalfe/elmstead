import { openingExtent } from "../geometry/opening.js";
import { distanceToOutline, polygonProblems } from "../geometry/polygon.js";
import { railingRun } from "../geometry/railing.js";
import { flightRun } from "../geometry/stair.js";
import { wallLength, wallTopMin } from "../geometry/wall.js";
import { toVec, type Vec } from "../geometry/vec.js";
import { idNodes } from "../schema/ids.js";
import type { BuildingModel, Opening, Polygon, Storey, Wall } from "../schema/schema.js";
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

/** Every outline-bearing element on a storey: rooms, slabs and stair landings. */
function outlined(storey: Storey): { id: string; outline: Polygon }[] {
  return [
    ...storey.rooms,
    ...storey.slabs,
    ...(storey.stairs ?? []).flatMap((s) => s.segments.flatMap((seg) => (seg.kind === "landing" ? [seg] : []))),
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
      if (kinds[0] !== "flight")
        issues.push({
          level: "ERROR",
          id: stair.id,
          message: "the first segment is a landing: a stair must start with a flight",
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

/** Every cross-element rule, run before any output is written. */
export const checkModel = (model: BuildingModel): Issue[] => [
  ...checkComponents(model),
  ...checkIds(model),
  ...checkWalls(model),
  ...checkRailings(model),
  ...checkOpenings(model),
  ...checkOutlines(model),
  ...checkStairs(model),
];
