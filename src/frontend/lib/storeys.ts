/** Storey ordering, selection and height, apart from the viewer so they can be tested without a browser. */
import { wallHeight } from "../../shared/geometry/wall.js";
import type { Storey } from "../../shared/schema/schema.js";

/** The model's storeys, lowest first: the selector's order and a cumulative choice's order. */
export function storeysLowestFirst<S extends { elevation: number }>(model: { storeys: readonly S[] }): S[] {
  return [...model.storeys].sort((a, b) => a.elevation - b.elevation);
}

/** Whether `ids` is every storey up to one floor: the shape the selector writes to `?storeys=`. */
export function isStoreyPrefix(ids: readonly string[], ordered: readonly { id: string }[]): boolean {
  const selected = new Set(ids);
  return ordered.every((s, i) => selected.has(s.id) === i < ids.length);
}

/**
 * The height (scene m) any of a storey's elements reaches. A storey with no walls, such as the
 * street level, is topped by its railings; a stair climbs to the storey above.
 */
export function storeyTop(storey: Storey, byId: Map<string, Storey>): number {
  let top = storey.elevation + Math.max(0, ...storey.walls.map((w) => wallHeight(w)));
  for (const o of storey.openings) top = Math.max(top, storey.elevation + o.sillHeight + o.height);
  for (const slab of storey.slabs) top = Math.max(top, storey.elevation + slab.elevationOffset);
  for (const r of storey.railings ?? [])
    top = Math.max(top, storey.elevation + Math.max(r.startBase ?? 0, r.endBase ?? 0) + r.height);
  for (const st of storey.stairs ?? []) top = Math.max(top, byId.get(st.toStoreyId)?.elevation ?? storey.elevation);
  return top / 1000;
}
