// Every id-bearing node in a model, for the id check, the constraint index and revisions.
import type {
  BuildingModel,
  Door,
  DoorComponent,
  Railing,
  Room,
  Site,
  Slab,
  Stair,
  StairFlight,
  StairLanding,
  Storey,
  Wall,
  Window,
  WindowComponent,
} from "./schema.js";

/** The arrays of id-bearing elements on a storey. */
export const STOREY_COLLECTIONS = ["walls", "openings", "slabs", "rooms", "stairs", "railings"] as const;
export type StoreyCollection = (typeof STOREY_COLLECTIONS)[number];

/** The arrays of components, under `components`. */
export const COMPONENT_COLLECTIONS = ["doors", "windows"] as const;
export type ComponentCollection = (typeof COMPONENT_COLLECTIONS)[number];

/**
 * Where a node lives, for anything that edits a model by id: an element in one of a storey's arrays,
 * or a component in one of the component arrays. The project, site, building, storeys and stair
 * segments have no place: they are not edited on their own.
 */
export type IdPlace =
  { storey: string; collection: StoreyCollection; index: number } | { collection: ComponentCollection; index: number };

/** A node on a storey, with that storey's id. */
type OnStorey<K extends string, E> = { kind: K; element: E; storey: string };
/** A node in one of the model's arrays, with where it is. */
type Placed = { place: IdPlace };

/** Every id-bearing node, tagged with its kind; the kinds that live on a storey carry its id. */
export type IdNode =
  | { kind: "project"; element: BuildingModel["project"] }
  | { kind: "site"; element: Site }
  | { kind: "building"; element: BuildingModel["building"] }
  | ({ kind: "door component"; element: DoorComponent } & Placed)
  | ({ kind: "window component"; element: WindowComponent } & Placed)
  | OnStorey<"storey", Storey>
  | (OnStorey<"wall", Wall> & Placed)
  | (OnStorey<"door", Door> & Placed)
  | (OnStorey<"window", Window> & Placed)
  | (OnStorey<"slab", Slab> & Placed)
  | (OnStorey<"room", Room> & Placed)
  | (OnStorey<"stair", Stair> & Placed)
  | OnStorey<"stair flight", StairFlight>
  | OnStorey<"stair landing", StairLanding>
  | (OnStorey<"railing", Railing> & Placed);

/** The kinds of node that live on a storey. */
export type StoreyKind = Extract<IdNode, { storey: string }>["kind"];

/** Every id-bearing node in model order, components last. Ids are not checked for uniqueness here. */
export function idNodes(model: BuildingModel): IdNode[] {
  const nodes: IdNode[] = [
    { kind: "project", element: model.project },
    { kind: "site", element: model.site },
    { kind: "building", element: model.building },
  ];
  for (const s of model.storeys) {
    const storey = s.id;
    const at = (collection: StoreyCollection, index: number): IdPlace => ({ storey, collection, index });
    nodes.push({ kind: "storey", element: s, storey });
    s.walls.forEach((w, i) => nodes.push({ kind: "wall", element: w, storey, place: at("walls", i) }));
    s.openings.forEach((o, i) =>
      nodes.push(
        o.kind === "door"
          ? { kind: "door", element: o, storey, place: at("openings", i) }
          : { kind: "window", element: o, storey, place: at("openings", i) },
      ),
    );
    s.slabs.forEach((sl, i) => nodes.push({ kind: "slab", element: sl, storey, place: at("slabs", i) }));
    s.rooms.forEach((r, i) => nodes.push({ kind: "room", element: r, storey, place: at("rooms", i) }));
    (s.stairs ?? []).forEach((st, i) => {
      nodes.push({ kind: "stair", element: st, storey, place: at("stairs", i) });
      for (const seg of st.segments)
        nodes.push(
          seg.kind === "flight"
            ? { kind: "stair flight", element: seg, storey }
            : { kind: "stair landing", element: seg, storey },
        );
    });
    (s.railings ?? []).forEach((r, i) => nodes.push({ kind: "railing", element: r, storey, place: at("railings", i) }));
  }
  (model.components?.doors ?? []).forEach((c, index) =>
    nodes.push({ kind: "door component", element: c, place: { collection: "doors", index } }),
  );
  (model.components?.windows ?? []).forEach((c, index) =>
    nodes.push({ kind: "window component", element: c, place: { collection: "windows", index } }),
  );
  return nodes;
}

/** A revision edit, to a model or to its constraints, that cannot be applied. `id` is what it names. */
export class RevisionError extends Error {
  constructor(
    readonly id: string,
    message: string,
  ) {
    super(message);
  }
}
