// Every id-bearing node in a model, for the id check, the constraint index and revisions.
import {
  COMPONENT_COLLECTIONS,
  COMPONENT_KINDS,
  STOREY_COLLECTIONS,
  STOREY_KINDS,
  type ComponentCollection,
  type KindEntry,
  type StoreyCollection,
} from "./kinds.js";
import type {
  BuildingModel,
  Door,
  DoorComponent,
  Furnishing,
  Railing,
  Room,
  Site,
  Slab,
  Stair,
  StairFlight,
  StairLanding,
  StairWinder,
  Storey,
  Wall,
  Window,
  WindowComponent,
} from "./schema.js";

export {
  COMPONENT_COLLECTIONS,
  COMPONENT_KINDS,
  STOREY_COLLECTIONS,
  STOREY_KINDS,
  type ComponentCollection,
  type StoreyCollection,
} from "./kinds.js";

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
  | OnStorey<"stair winder", StairWinder>
  | (OnStorey<"railing", Railing> & Placed)
  | (OnStorey<"furnishing", Furnishing> & Placed);

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
    nodes.push({ kind: "storey", element: s, storey });
    for (const collection of STOREY_COLLECTIONS) {
      const entry = STOREY_KINDS[collection] as KindEntry<any>;
      const elements = (s[collection] ?? []) as { id: string }[];
      elements.forEach((element, index) => {
        nodes.push({ kind: entry.kind(element), element, storey, place: { storey, collection, index } } as IdNode);
        for (const child of entry.children?.(element) ?? []) nodes.push({ ...child, storey } as IdNode);
      });
    }
  }
  for (const collection of COMPONENT_COLLECTIONS) {
    const entry = COMPONENT_KINDS[collection] as KindEntry<any>;
    const elements = (model.components?.[collection] ?? []) as { id: string }[];
    elements.forEach((element, index) =>
      nodes.push({ kind: entry.kind(element), element, place: { collection, index } } as IdNode),
    );
  }
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
