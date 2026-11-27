/**
 * Revisions: a model written as edits on another. `revise(base, edits)` returns a new model and never
 * changes `base`. Every edit names ids, so a revision fails loudly when its base changes under it.
 */
import type { z } from "zod";
import {
  idNodes,
  RevisionError,
  type ComponentCollection,
  type IdNode,
  type IdPlace,
  type StoreyCollection,
} from "../schema/ids.js";
import {
  DoorComponentSchema,
  OpeningSchema,
  RailingSchema,
  RoomSchema,
  SlabSchema,
  StairSchema,
  WallSchema,
  WindowComponentSchema,
  type BuildingModel,
  type Components,
  type Storey,
} from "../schema/schema.js";

/** What `addTo` puts on a storey, by collection. */
export type StoreyAdditions = { [K in StoreyCollection]?: NonNullable<Storey[K]> };
/** An element or component that `replace` puts in the place of the one with its id. */
export type Replacement = NonNullable<Storey[StoreyCollection]>[number] | Components[ComponentCollection][number];

export type Edit =
  | { op: "remove"; ids: string[] }
  | { op: "replace"; elements: Replacement[] }
  | { op: "addTo"; storey: string; elements: StoreyAdditions }
  | { op: "addComponents"; components: Partial<Components> };

type Ref = string | { id: string };
const idOf = (r: Ref): string => (typeof r === "string" ? r : r.id);

/** Remove elements or components by id. What depends on them (a removed wall's openings) is not removed. */
export const remove = (...refs: Ref[]): Edit => ({ op: "remove", ids: refs.map(idOf) });
/** Put each element or component in the place of the one with the same id. */
export const replace = (...elements: Replacement[]): Edit => ({ op: "replace", elements });
/** Add elements to a storey, by collection: `addTo("storey-ground", { walls: [...], openings: [...] })`. */
export const addTo = (storey: Ref, elements: StoreyAdditions): Edit => ({
  op: "addTo",
  storey: idOf(storey),
  elements,
});
/** Add door and window components. */
export const addComponents = (components: Partial<Components>): Edit => ({ op: "addComponents", components });

const SCHEMAS: Record<StoreyCollection | ComponentCollection, z.ZodType> = {
  walls: WallSchema,
  openings: OpeningSchema,
  slabs: SlabSchema,
  rooms: RoomSchema,
  stairs: StairSchema,
  railings: RailingSchema,
  doors: DoorComponentSchema,
  windows: WindowComponentSchema,
};

/** The value, checked against what its collection holds; `verb` says what was being done with it. */
function accepted(
  collection: StoreyCollection | ComponentCollection,
  value: unknown,
  id: string,
  verb: string,
): unknown {
  const r = SCHEMAS[collection].safeParse(value);
  if (!r.success) {
    const detail = r.error.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`).join("; ");
    throw new RevisionError(id, `cannot ${verb}: not a valid ${collection} entry (${detail})`);
  }
  return structuredClone(value);
}

/** The model's node for an id; the first, if the id is used twice (checkIds reports that). */
const nodeOf = (model: BuildingModel, id: string): IdNode | undefined =>
  idNodes(model).find((n) => n.element.id === id);

/** Where the element or component with an id lives, or why it cannot be edited. */
function editable(model: BuildingModel, id: string, verb: string): IdPlace {
  const node = nodeOf(model, id);
  if (!node) throw new RevisionError(id, `cannot ${verb} ${id}: it is not in the model`);
  if (node.kind === "storey") throw new RevisionError(id, `cannot ${verb} ${id}: revisions cannot change storeys`);
  if (!("place" in node))
    throw new RevisionError(
      id,
      `cannot ${verb} ${id}: a ${node.kind} is not edited on its own${node.kind.startsWith("stair ") ? "; replace its stair" : ""}`,
    );
  return node.place;
}

/** The array a place is in. */
function arrayOf(model: BuildingModel, place: IdPlace): unknown[] {
  if ("storey" in place) return model.storeys.find((s) => s.id === place.storey)![place.collection]!;
  return model.components![place.collection];
}

/** Each added element is in the model before the next is checked, so this also catches a repeat within one edit. */
function assertNew(model: BuildingModel, id: string): void {
  if (nodeOf(model, id)) throw new RevisionError(id, `cannot add ${id}: the id is already in the model`);
}

/** A new model: `base` with the edits applied in order. `base` is not changed. */
export function revise(base: BuildingModel, edits: readonly Edit[]): BuildingModel {
  const model = structuredClone(base);
  for (const edit of edits) {
    switch (edit.op) {
      case "remove":
        for (const id of edit.ids) {
          const place = editable(model, id, "remove");
          arrayOf(model, place).splice(place.index, 1);
        }
        break;
      case "replace":
        for (const element of edit.elements) {
          const place = editable(model, element.id, "replace");
          arrayOf(model, place)[place.index] = accepted(place.collection, element, element.id, `replace ${element.id}`);
        }
        break;
      case "addTo": {
        const storey = model.storeys.find((s) => s.id === edit.storey);
        if (!storey)
          throw new RevisionError(edit.storey, `cannot add to ${edit.storey}: it is not a storey of the model`);
        for (const [collection, elements] of Object.entries(edit.elements) as [StoreyCollection, { id: string }[]][]) {
          for (const element of elements) {
            assertNew(model, element.id);
            const list = (storey[collection] ??= []) as unknown[];
            list.push(accepted(collection, element, element.id, `add ${element.id} to ${collection}`));
          }
        }
        break;
      }
      case "addComponents": {
        const components = (model.components ??= { doors: [], windows: [] });
        for (const [collection, list] of Object.entries(edit.components) as [ComponentCollection, { id: string }[]][]) {
          for (const c of list) {
            assertNew(model, c.id);
            (components[collection] as unknown[]).push(accepted(collection, c, c.id, `add ${c.id} to ${collection}`));
          }
        }
        break;
      }
    }
  }
  return model;
}
