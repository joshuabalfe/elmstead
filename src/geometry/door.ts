import type { Door, DoorComponent } from "../schema/schema.js";
import type { Rect } from "./window.js";

export interface DoorDivision {
  leaf: Rect;
  frame: Rect[];
}

/**
 * How a door opening divides into its frame and leaf, from its component. The frame has jambs and
 * a head but no sill, so the leaf reaches the floor; the pieces do not overlap and tile the
 * opening. Without a frame the leaf fills it.
 */
export function doorDivision(d: Pick<Door, "width" | "height">, design?: Pick<DoorComponent, "frame">): DoorDivision {
  const f = design?.frame?.width ?? 0;
  const frame: Rect[] = f
    ? [
        { x: 0, z: 0, w: f, h: d.height - f },
        { x: d.width - f, z: 0, w: f, h: d.height - f },
        { x: 0, z: d.height - f, w: d.width, h: f },
      ]
    : [];
  return { leaf: { x: f, z: 0, w: d.width - 2 * f, h: d.height - f }, frame };
}
