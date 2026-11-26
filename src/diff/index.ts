/**
 * A revision's diff against its base: what it adds, removes and changes, element by element, matched
 * by the ids the two models share. Pure, so the CLI and the viewer use the same function.
 */
import { idNodes, type IdNode } from "../schema/ids.js";
import type { BuildingModel } from "../schema/schema.js";

/** One listed element: its id, its kind as `idNodes` names it, and the storey it is on (none for a component). */
export interface DiffEntry {
  id: string;
  kind: string;
  storey?: string;
}

export interface ModelDiff {
  /** In the revision only, in the revision's order. */
  added: DiffEntry[];
  /** In the base only, in the base's order. */
  removed: DiffEntry[];
  /** In both but different, in the revision's order. */
  changed: DiffEntry[];
}

export type DiffStatus = keyof ModelDiff;

/**
 * The nodes the diff compares. The project, site and building aren't elements of the proposal, and a
 * stair's flights and landings are compared as part of their stair.
 */
const COMPARED = new Set<IdNode["kind"]>(["storey", "wall", "door", "window", "slab", "room", "stair", "railing", "door component", "window component"]);

/** What is compared of a node: its JSON, a storey's without its element arrays, so only its own fields count. */
function signature(n: IdNode): string {
  if (n.kind !== "storey") return JSON.stringify(n.element);
  const { walls: _w, openings: _o, slabs: _s, rooms: _r, stairs: _st, railings: _ra, ...fields } = n.element;
  return JSON.stringify(fields);
}

const entry = (n: IdNode): DiffEntry => ({ id: n.element.id, kind: n.kind, ...("storey" in n ? { storey: n.storey } : {}) });

/** The compared nodes of a model in model order, by id; the first of a duplicated id (checkIds reports it). */
function compared(model: BuildingModel): Map<string, IdNode> {
  const nodes = new Map<string, IdNode>();
  for (const n of idNodes(model)) if (COMPARED.has(n.kind) && !nodes.has(n.element.id)) nodes.set(n.element.id, n);
  return nodes;
}

/**
 * The diff of `revision` against `base`. An element is changed when its JSON differs or it moved to
 * another storey. An opening is also changed when its component is changed or added, or its host
 * wall is changed: either moves or reshapes it without touching its own JSON (an opening is placed by
 * `offsetAlongWall` from its wall's start).
 */
export function diffModels(base: BuildingModel, revision: BuildingModel): ModelDiff {
  const before = compared(base);
  const after = compared(revision);
  const changedIds = new Set<string>();
  for (const [id, n] of after) {
    const was = before.get(id);
    if (!was) continue;
    const moved = "storey" in n && "storey" in was && n.kind !== "storey" && n.storey !== was.storey;
    if (moved || signature(n) !== signature(was)) changedIds.add(id);
  }
  const addedIds = new Set([...after.keys()].filter((id) => !before.has(id)));
  for (const [id, n] of after) {
    if ((n.kind !== "door" && n.kind !== "window") || addedIds.has(id) || changedIds.has(id)) continue;
    const component = n.element.componentId;
    if (changedIds.has(n.element.wallId) || (component !== undefined && (changedIds.has(component) || addedIds.has(component)))) changedIds.add(id);
  }
  return {
    added: [...after.values()].filter((n) => addedIds.has(n.element.id)).map(entry),
    removed: [...before.values()].filter((n) => !after.has(n.element.id)).map(entry),
    changed: [...after.values()].filter((n) => changedIds.has(n.element.id)).map(entry),
  };
}
