import { z } from "zod";
import { IdSchema } from "../schema/schema.js";
import { NonNegativeMmSchema } from "../schema/units.js";

/**
 * The constraints file beside a model: known real-world distances between points named from the
 * model's ids. Kept out of the building schema, so constraints never reach building.json or IFC.
 */

/** A wall face: left or right looking from start to end, or a compass side of an axis-aligned wall. */
export const FaceSchema = z.enum(["left", "right", "north", "south", "east", "west"]);

export const WallFaceSchema = z.strictObject({ wall: IdSchema, face: FaceSchema });

/** Where the lines of two wall faces cross. */
export const CornerPointSchema = z.strictObject({ corner: z.tuple([WallFaceSchema, WallFaceSchema]) });

/** One end of a wall: on its start→end line, or on one face. */
export const WallEndPointSchema = z.strictObject({ wall: IdSchema, end: z.enum(["start", "end"]), face: FaceSchema.optional() });

/** An opening's jamb nearest the wall start, its far jamb, or half way between. */
export const OpeningPointSchema = z.strictObject({ opening: IdSchema, at: z.enum(["start", "end", "centre"]), face: FaceSchema.optional() });

/** A room outline vertex: the one furthest in a compass direction, or by number from 0. */
export const RoomCornerPointSchema = z.strictObject({
  /** Leave out inside a room group to mean the group's room. */
  room: IdSchema.optional(),
  corner: z.union([z.enum(["north-east", "north-west", "south-east", "south-west"]), z.int().nonnegative()]),
});

export const PointSchema = z.union([CornerPointSchema, WallEndPointSchema, OpeningPointSchema, RoomCornerPointSchema]);

/** Straight line, difference in plan x or y, or projected onto a wall's direction. All unsigned. */
export const MeasureSchema = z.union([z.enum(["straight", "x", "y"]), z.strictObject({ along: IdSchema })]);

export const DEFAULT_TOLERANCE = 10;

export const ConstraintSchema = z.strictObject({
  id: IdSchema,
  /** Where the measurement came from. */
  note: z.string().optional(),
  from: PointSchema,
  to: PointSchema,
  measure: MeasureSchema,
  distance: NonNegativeMmSchema,
  /** Defaults to DEFAULT_TOLERANCE. */
  tolerance: NonNegativeMmSchema.optional(),
});

/** Constraints scoped to one storey or one room. The scope labels their issues. */
export const ConstraintGroupSchema = z
  .strictObject({
    storey: IdSchema.optional(),
    room: IdSchema.optional(),
    constraints: z.array(ConstraintSchema),
  })
  .refine((g) => (g.storey === undefined) !== (g.room === undefined), "a group names exactly one storey or one room");

export const ConstraintsFileSchema = z.array(ConstraintGroupSchema);

export type Face = z.infer<typeof FaceSchema>;
export type WallFace = z.infer<typeof WallFaceSchema>;
export type CornerPoint = z.infer<typeof CornerPointSchema>;
export type RoomCornerPoint = z.infer<typeof RoomCornerPointSchema>;
export type Point = z.infer<typeof PointSchema>;
export type Measure = z.infer<typeof MeasureSchema>;
export type Constraint = z.infer<typeof ConstraintSchema>;
export type ConstraintGroup = z.infer<typeof ConstraintGroupSchema>;
