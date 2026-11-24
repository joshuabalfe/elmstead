import { z } from "zod";
import { DegSchema, degBetween, MmSchema, NonNegativeMmSchema, PositiveMmSchema } from "./units.js";

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
  /** The door or window component (in `components`) this opening is one of: its design, not its size. */
  componentId: IdSchema.optional(),
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

/**
 * Both jambs splayed `angle` degrees off square, from the middle of the wall to `face` (looking from
 * wall start towards wall end). The head, sill and the other half of the reveal stay square.
 */
export const RevealSchema = z.strictObject({
  face: z.enum(["left", "right"]),
  angle: degBetween(0, 90),
}).meta({ id: "Reveal" });

export const WindowSchema = z.strictObject({
  kind: z.literal("window"),
  ...openingBase,
  /** Splayed jambs. `width` stays the width in the middle of the wall, where the frame sits. */
  reveal: RevealSchema.optional(),
}).meta({ id: "Window" });

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

/**
 * A door or window design (construction, not size) shared by every opening that uses it, written
 * to IFC as an IfcDoorType or IfcWindowType. Size belongs to each opening, as on IfcDoor and
 * IfcWindow: one design comes in many sizes. Detail of the design (frame, glazing, panels, ...)
 * goes here as it is added.
 */
const componentBase = {
  id: IdSchema,
  name: z.string().min(1),
};

/** A frame around the inside of the opening, the same width all round. */
export const FrameSchema = z.strictObject({ width: PositiveMmSchema }).meta({ id: "Frame" });

export const DoorComponentSchema = z.strictObject({
  ...componentBase,
  /** Frame around the jambs and head; without one the leaf fills the opening. */
  frame: FrameSchema.optional(),
}).meta({ id: "DoorComponent" });

const ratios = z.array(z.number().positive()).min(1);

/** How glazing bars divide a window into panes. Ratios, so one design fits windows of any size. */
export const GlazingSchema = z.strictObject({
  /** Widths of the columns of panes, left to right, as ratios: [1, 2, 1] is a wide centre pane. */
  columns: ratios,
  /** Heights of the rows of panes, bottom to top, as ratios: [1, 1] puts a bar half way up. */
  rows: ratios,
  /** Width of the bars between panes. The ratios share out what is left inside the frame. */
  barWidth: PositiveMmSchema,
}).meta({ id: "Glazing" });

export const WindowComponentSchema = z.strictObject({
  ...componentBase,
  /** Frame; without one the glass fills the opening. */
  frame: FrameSchema.optional(),
  /** Glazing bars, dividing what is inside the frame; without them the window is a single pane. */
  glazing: GlazingSchema.optional(),
}).meta({ id: "WindowComponent" });

export const ComponentsSchema = z.strictObject({
  doors: z.array(DoorComponentSchema),
  windows: z.array(WindowComponentSchema),
}).meta({ id: "Components" });

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
  /** Door and window designs that openings refer to by componentId. */
  components: ComponentsSchema.optional(),
  storeys: z.array(StoreySchema).min(1),
});

export type Point = z.infer<typeof PointSchema>;
export type Polygon = z.infer<typeof PolygonSchema>;
export type Wall = z.infer<typeof WallSchema>;
export type Swing = z.infer<typeof SwingSchema>;
export type Door = z.infer<typeof DoorSchema>;
export type Window = z.infer<typeof WindowSchema>;
export type Opening = z.infer<typeof OpeningSchema>;
export type Reveal = z.infer<typeof RevealSchema>;
export type DoorComponent = z.infer<typeof DoorComponentSchema>;
export type WindowComponent = z.infer<typeof WindowComponentSchema>;
export type Components = z.infer<typeof ComponentsSchema>;
export type Glazing = z.infer<typeof GlazingSchema>;
export type Slab = z.infer<typeof SlabSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type Storey = z.infer<typeof StoreySchema>;
export type Site = z.infer<typeof SiteSchema>;
export type BuildingModel = z.infer<typeof BuildingModelSchema>;
