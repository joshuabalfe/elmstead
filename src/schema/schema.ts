import { z } from "zod";
import { DegSchema, MmSchema, NonNegativeMmSchema, PositiveMmSchema } from "./units.js";

/**
 * The building JSON contract. Keep this deliberately small: add element types only when asked.
 * Structural validation lives here; cross-element rules (ids, opening fit, ...) live in src/checks/.
 */

export const SCHEMA_VERSION = 1;

export const IdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "ids are lower-case kebab-case, e.g. wall-north-1");

export const PointSchema = z.strictObject({ x: MmSchema, y: MmSchema }).meta({ id: "Point" });

/** Open polygon (first point is not repeated), plan coordinates in mm. */
export const PolygonSchema = z.array(PointSchema).min(3);

export const WallSchema = z.strictObject({
  id: IdSchema,
  name: z.string().optional(),
  start: PointSchema,
  end: PointSchema,
  thickness: PositiveMmSchema,
  height: PositiveMmSchema,
  /** Where the body sits relative to the start→end line, looking from start towards end. */
  justification: z.enum(["centre", "left", "right"]),
}).meta({ id: "Wall" });

export const SwingSchema = z.strictObject({
  /** Which end of the opening (nearest the wall start, or the wall end) the hinge is on. */
  hinge: z.enum(["start", "end"]),
  /** Which side of the wall the door opens towards, looking from wall start towards wall end. */
  side: z.enum(["left", "right"]),
}).meta({ id: "Swing" });

const openingBase = {
  id: IdSchema,
  name: z.string().optional(),
  wallId: IdSchema,
  /** Distance along the wall from its start to the opening's near edge. */
  offsetAlongWall: NonNegativeMmSchema,
  width: PositiveMmSchema,
  height: PositiveMmSchema,
  sillHeight: NonNegativeMmSchema,
};

export const DoorSchema = z.strictObject({
  kind: z.literal("door"),
  ...openingBase,
  /** Defaults to { hinge: "start", side: "left" }. */
  swing: SwingSchema.optional(),
}).meta({ id: "Door" });

export const WindowSchema = z.strictObject({ kind: z.literal("window"), ...openingBase }).meta({ id: "Window" });

export const OpeningSchema = z.discriminatedUnion("kind", [DoorSchema, WindowSchema]);

export const SlabSchema = z.strictObject({
  id: IdSchema,
  name: z.string().optional(),
  outline: PolygonSchema,
  thickness: PositiveMmSchema,
  /** Top of slab relative to the storey elevation. The slab extends downwards from here. */
  elevationOffset: MmSchema,
}).meta({ id: "Slab" });

export const RoomSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  outline: PolygonSchema,
}).meta({ id: "Room" });

export const StoreySchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  /** Finished floor level relative to the building's zero. */
  elevation: MmSchema,
  walls: z.array(WallSchema),
  openings: z.array(OpeningSchema),
  slabs: z.array(SlabSchema),
  rooms: z.array(RoomSchema),
}).meta({ id: "Storey" });

const NamedSchema = z.strictObject({ id: IdSchema, name: z.string().min(1) });

export const SiteSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  /** Angle of true north, counter-clockwise from plan +y. Default 0 (north is up). */
  northAngle: DegSchema.optional(),
}).meta({ id: "Site" });

export const BuildingModelSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  project: NamedSchema,
  site: SiteSchema,
  building: NamedSchema,
  storeys: z.array(StoreySchema).min(1),
});

export type Point = z.infer<typeof PointSchema>;
export type Polygon = z.infer<typeof PolygonSchema>;
export type Wall = z.infer<typeof WallSchema>;
export type Swing = z.infer<typeof SwingSchema>;
export type Door = z.infer<typeof DoorSchema>;
export type Window = z.infer<typeof WindowSchema>;
export type Opening = z.infer<typeof OpeningSchema>;
export type Slab = z.infer<typeof SlabSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type Storey = z.infer<typeof StoreySchema>;
export type Site = z.infer<typeof SiteSchema>;
export type BuildingModel = z.infer<typeof BuildingModelSchema>;
