/**
 * The element-kind table: one entry per storey collection and component collection. The id walk,
 * revision validation, the diff and the viewer's storey ownership all read this table, so a new
 * collection cannot be handled by one and silently missed by another.
 */
import type { z } from "zod";
import type { IdNode } from "./ids.js";
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
  type Opening,
  type Stair,
  type Storey,
} from "./schema.js";

/** Every array-valued field of `T`, optional or not. */
type ArrayKeys<T> = { [K in keyof T]-?: NonNullable<T[K]> extends readonly unknown[] ? K : never }[keyof T];

/** The arrays of id-bearing elements on a storey, derived from the schema's `Storey`. */
export type StoreyArrayKey = ArrayKeys<Storey>;
/** The arrays of components, under `components`. */
export type ComponentArrayKey = ArrayKeys<NonNullable<BuildingModel["components"]>>;

/** A nested id-bearing element: walked as its own node, but not placed, edited or compared on its own. */
export interface ElementChild {
  kind: IdNode["kind"];
  element: { id: string };
}

export interface KindEntry<E extends { id: string }> {
  schema: z.ZodType<E>;
  /** The node kind an element yields; openings yield `door` or `window`. */
  kind: (element: E) => IdNode["kind"];
  /** Nested id-bearing elements, walked directly after their parent: a stair's flights and landings. */
  children?: (element: E) => ElementChild[];
}

type StoreyKindEntry<K extends StoreyArrayKey> = KindEntry<NonNullable<Storey[K]>[number]>;
type ComponentKindEntry<K extends ComponentArrayKey> = KindEntry<NonNullable<BuildingModel["components"]>[K][number]>;

/** The storey collections, in model order, with the schema and kind each element yields. */
export const STOREY_KINDS = {
  walls: { schema: WallSchema, kind: () => "wall" },
  openings: { schema: OpeningSchema, kind: (opening: Opening) => opening.kind },
  slabs: { schema: SlabSchema, kind: () => "slab" },
  rooms: { schema: RoomSchema, kind: () => "room" },
  stairs: {
    schema: StairSchema,
    kind: () => "stair",
    children: (stair: Stair): ElementChild[] =>
      stair.segments.map((segment) => ({
        kind:
          segment.kind === "flight" ? "stair flight" : segment.kind === "landing" ? "stair landing" : "stair winder",
        element: segment,
      })),
  },
  railings: { schema: RailingSchema, kind: () => "railing" },
} satisfies { [K in StoreyArrayKey]: StoreyKindEntry<K> };

/** The component collections, after the storeys. */
export const COMPONENT_KINDS = {
  doors: { schema: DoorComponentSchema, kind: () => "door component" },
  windows: { schema: WindowComponentSchema, kind: () => "window component" },
} satisfies { [K in ComponentArrayKey]: ComponentKindEntry<K> };

/** The storey collections, in model order. */
export const STOREY_COLLECTIONS = Object.keys(STOREY_KINDS) as readonly StoreyArrayKey[];
export type StoreyCollection = StoreyArrayKey;

/** The component collections, after the storeys. */
export const COMPONENT_COLLECTIONS = Object.keys(COMPONENT_KINDS) as readonly ComponentArrayKey[];
export type ComponentCollection = ComponentArrayKey;
