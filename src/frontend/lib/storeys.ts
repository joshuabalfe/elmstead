/** Storey ordering and selection, apart from the viewer so it can be tested without a browser. */

/** The model's storeys, lowest first: the selector's order and a cumulative choice's order. */
export function storeysLowestFirst<S extends { elevation: number }>(model: { storeys: readonly S[] }): S[] {
  return [...model.storeys].sort((a, b) => a.elevation - b.elevation);
}

/** Whether `ids` is every storey up to one floor: the shape the selector writes to `?storeys=`. */
export function isStoreyPrefix(ids: readonly string[], ordered: readonly { id: string }[]): boolean {
  const selected = new Set(ids);
  return ordered.every((s, i) => selected.has(s.id) === i < ids.length);
}
