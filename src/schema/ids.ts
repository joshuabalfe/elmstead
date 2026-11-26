import type { BuildingModel } from "./schema.js";

/** The arrays of id-bearing elements on a storey. */
export const STOREY_COLLECTIONS = ["walls", "openings", "slabs", "rooms", "stairs", "railings"] as const;
export type StoreyCollection = (typeof STOREY_COLLECTIONS)[number];

/** The arrays of components, under `components`. */
export const COMPONENT_COLLECTIONS = ["doors", "windows"] as const;
export type ComponentCollection = (typeof COMPONENT_COLLECTIONS)[number];

/**
 * Where an id lives, for anything that edits a model by id: an element in one of a storey's arrays,
 * or a component in one of the component arrays. The project, site, building, storeys and stair
 * segments have no place: they are not edited on their own.
 */
export type IdPlace =
  | { storey: string; collection: StoreyCollection; index: number }
  | { collection: ComponentCollection; index: number };

export interface IdEntry {
  id: string;
  /** The kind of thing that owns the id: "wall", "door", "stair flight", "window component", ... */
  kind: string;
  /** The storey an element is on, or the storey itself; undefined for the project, site, building and components. */
  storey?: string;
  place?: IdPlace;
  element: unknown;
}

/** Every id-bearing node, in model order, duplicates included (checkIds reports them). */
export function idEntries(model: BuildingModel): IdEntry[] {
  const entries: IdEntry[] = [
    { id: model.project.id, kind: "project", element: model.project },
    { id: model.site.id, kind: "site", element: model.site },
    { id: model.building.id, kind: "building", element: model.building },
  ];
  for (const s of model.storeys) {
    const storey = s.id;
    entries.push({ id: s.id, kind: "storey", storey, element: s });
    s.walls.forEach((w, index) => entries.push({ id: w.id, kind: "wall", storey, place: { storey, collection: "walls", index }, element: w }));
    s.openings.forEach((o, index) => entries.push({ id: o.id, kind: o.kind, storey, place: { storey, collection: "openings", index }, element: o }));
    s.slabs.forEach((sl, index) => entries.push({ id: sl.id, kind: "slab", storey, place: { storey, collection: "slabs", index }, element: sl }));
    s.rooms.forEach((r, index) => entries.push({ id: r.id, kind: "room", storey, place: { storey, collection: "rooms", index }, element: r }));
    (s.stairs ?? []).forEach((st, index) => {
      entries.push({ id: st.id, kind: "stair", storey, place: { storey, collection: "stairs", index }, element: st });
      for (const seg of st.segments) entries.push({ id: seg.id, kind: seg.kind === "flight" ? "stair flight" : "stair landing", storey, element: seg });
    });
    (s.railings ?? []).forEach((r, index) => entries.push({ id: r.id, kind: "railing", storey, place: { storey, collection: "railings", index }, element: r }));
  }
  (model.components?.doors ?? []).forEach((c, index) => entries.push({ id: c.id, kind: "door component", place: { collection: "doors", index }, element: c }));
  (model.components?.windows ?? []).forEach((c, index) => entries.push({ id: c.id, kind: "window component", place: { collection: "windows", index }, element: c }));
  return entries;
}

/** Every id in the model. Ids are unique model-wide, so one map will do; a duplicate keeps the first. */
export type IdIndex = Map<string, IdEntry>;

export function indexIds(model: BuildingModel): IdIndex {
  const ix: IdIndex = new Map();
  for (const entry of idEntries(model)) if (!ix.has(entry.id)) ix.set(entry.id, entry);
  return ix;
}
