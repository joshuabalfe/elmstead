/**
 * Helpers for writing a model's constraints file. Each takes an id or the model object itself and
 * builds a plain value of the constraints schema.
 */
import type { Opening, Room, Storey, Wall } from "../schema/schema.js";
import type { Constraint, ConstraintGroup, Face, Point } from "./schema.js";

export * from "./schema.js";
export { addGroups, removeConstraint, replaceConstraint, reviseConstraints } from "./revise.js";
export { m, mm } from "../schema/units.js";

type Ref<T extends { id: string }> = T | string;
const idOf = <T extends { id: string }>(r: Ref<T>): string => (typeof r === "string" ? r : r.id);

type CompassCorner = "north-east" | "north-west" | "south-east" | "south-west";

/** Where the lines of two wall faces cross, e.g. corner({ wall: west, face: "east" }, { wall: south, face: "north" }). */
export const corner = (a: { wall: Ref<Wall>; face: Face }, b: { wall: Ref<Wall>; face: Face }): Point => ({
  corner: [
    { wall: idOf(a.wall), face: a.face },
    { wall: idOf(b.wall), face: b.face },
  ],
});

/** One end of a wall: on its start→end line, or on `face`. */
export const wallEnd = (wall: Ref<Wall>, end: "start" | "end", face?: Face): Point => ({ wall: idOf(wall), end, ...(face ? { face } : {}) });

/** An opening's start jamb (nearest the wall start), end jamb or centre: on the wall line, or on `face`. */
export const jamb = (opening: Ref<Opening>, at: "start" | "end" | "centre", face?: Face): Point => ({ opening: idOf(opening), at, ...(face ? { face } : {}) });

/** A room outline vertex by compass direction or number. Inside `inRoom`, the room can be left out. */
export function roomCorner(corner: CompassCorner | number): Point;
export function roomCorner(room: Ref<Room>, corner: CompassCorner | number): Point;
export function roomCorner(a: Ref<Room> | CompassCorner | number, b?: CompassCorner | number): Point {
  return b === undefined ? { corner: a as CompassCorner | number } : { room: idOf(a as Ref<Room>), corner: b };
}

export const inStorey = (storey: Ref<Storey>, constraints: Constraint[]): ConstraintGroup => ({ storey: idOf(storey), constraints });

export const inRoom = (room: Ref<Room>, constraints: Constraint[]): ConstraintGroup => ({ room: idOf(room), constraints });

/** The default export of a constraints file. */
export const defineConstraints = (groups: ConstraintGroup[]): ConstraintGroup[] => groups;
