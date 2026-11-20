import { polygonProblems } from "../geometry/polygon.js";
import { wallLength } from "../geometry/wall.js";
import type { BuildingModel, Opening, Wall } from "../schema/schema.js";
import { checkComponents } from "./components.js";
import type { Issue } from "./issue.js";

/** Every id-bearing node, in model order, paired with the kind of thing that owns the id. */
function idEntries(model: BuildingModel): [string, string][] {
  const entries: [string, string][] = [
    [model.project.id, "project"],
    [model.site.id, "site"],
    [model.building.id, "building"],
  ];
  for (const storey of model.storeys) {
    entries.push([storey.id, "storey"]);
    for (const w of storey.walls) entries.push([w.id, "wall"]);
    for (const o of storey.openings) entries.push([o.id, o.kind]);
    for (const s of storey.slabs) entries.push([s.id, "slab"]);
    for (const r of storey.rooms) entries.push([r.id, "room"]);
  }
  for (const c of model.components?.doors ?? []) entries.push([c.id, "door component"]);
  for (const c of model.components?.windows ?? []) entries.push([c.id, "window component"]);
  return entries;
}

const isComponent = (kind: string): boolean => kind === "door component" || kind === "window component";

/** Ids are the GlobalId keyspace: a duplicate anywhere in the model would collide in IFC. */
export function checkIds(model: BuildingModel): Issue[] {
  const issues: Issue[] = [];
  const seen = new Map<string, string>();
  for (const [id, kind] of idEntries(model)) {
    const first = seen.get(id);
    if (first === undefined) {
      seen.set(id, kind);
      continue;
    }
    const message = isComponent(first) && isComponent(kind) ? "component id is used twice" : `id is already used by ${first}`;
    issues.push({ level: "ERROR", id, message });
  }
  return issues;
}

export function checkWalls(model: BuildingModel): Issue[] {
  const issues: Issue[] = [];
  for (const storey of model.storeys) {
    for (const w of storey.walls) {
      if (wallLength(w) === 0) issues.push({ level: "ERROR", id: w.id, message: "zero-length wall cannot be written to IFC" });
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
    const hosted = new Map<string, { opening: Opening; wall: Wall }>();
    for (const opening of storey.openings) {
      const wall = walls.get(opening.wallId);
      if (!wall) {
        issues.push({ level: "ERROR", id: opening.id, message: `wallId ${opening.wallId} is not a wall on this storey` });
        continue;
      }
      const length = wallLength(wall);
      if (length === 0) continue; // reported by checkWalls
      hosted.set(opening.id, { opening, wall });
      const pastEnd = opening.offsetAlongWall + opening.width - length;
      if (pastEnd > tolerance) issues.push({ level: "ERROR", id: opening.id, message: `opening is ${Math.round(pastEnd)} mm past the wall end` });
      const aboveTop = opening.sillHeight + opening.height - wall.height;
      if (aboveTop > tolerance) issues.push({ level: "ERROR", id: opening.id, message: `opening is ${Math.round(aboveTop)} mm above the wall top` });
    }
    const list = [...hosted.values()];
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]!;
        if (a.opening.wallId !== b.opening.wallId) continue;
        const along = a.opening.offsetAlongWall < b.opening.offsetAlongWall + b.opening.width && b.opening.offsetAlongWall < a.opening.offsetAlongWall + a.opening.width;
        const up = a.opening.sillHeight < b.opening.sillHeight + b.opening.height && b.opening.sillHeight < a.opening.sillHeight + a.opening.height;
        if (!along || !up) continue;
        issues.push({ level: "ERROR", id: a.opening.id, message: `opening overlaps ${b.opening.id}` });
        issues.push({ level: "ERROR", id: b.opening.id, message: `opening overlaps ${a.opening.id}` });
      }
    }
  }
  return issues;
}

export function checkOutlines(model: BuildingModel): Issue[] {
  const issues: Issue[] = [];
  for (const storey of model.storeys) {
    for (const element of [...storey.rooms, ...storey.slabs]) {
      for (const problem of polygonProblems(element.outline)) issues.push({ level: "ERROR", id: element.id, message: problem });
    }
  }
  return issues;
}

/** Every cross-element rule, run before any output is written. */
export const checkModel = (model: BuildingModel): Issue[] => [
  ...checkComponents(model),
  ...checkIds(model),
  ...checkWalls(model),
  ...checkOpenings(model),
  ...checkOutlines(model),
];