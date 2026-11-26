import { VIEWS, type View } from "../src/render/views.js";

/** The requested camera view, falling back to the plan-like top view for anything unknown. */
export const parseView = (value: string | null): View => (VIEWS.includes(value as View) ? (value as View) : "top");

export interface CameraForView {
  direction: readonly [number, number, number];
  projection: "Orthographic" | "Perspective";
}

/**
 * The yaw (radians about the scene's +Y) that turns a flat label — a plane laid down with its
 * texture's up along plan north — so its text reads left-to-right across the screen. `right` is
 * the camera's screen-right direction in scene axes; only its plan components matter.
 */
export function labelHeading(right: { x: number; z: number }): number {
  return Math.atan2(-right.z, right.x);
}

/** `?orient=project` keeps plan +y up and plan-axis corners; anything else orients to true north. */
export const parseOrient = (value: string | null): "north" | "project" => (value === "project" ? "project" : "north");

/**
 * Interactive corner views are true isometric: equal X, Y and Z direction components behind an
 * orthographic camera foreshorten all three axes equally. Snapshots keep the lower perspective
 * corner cameras that the rendered 3D PNGs have always used. Top is an orthographic plan view.
 *
 * The corners stay on the plan diagonals, where they show the building's corners. `northAngle`
 * (degrees counter-clockwise from plan +y) turns only Top: it looks down from a hair to true south,
 * so true north is up the screen. The scene has plan +y along −Z.
 */
export function cameraForView(view: View, snapshot: boolean, northAngle = 0): CameraForView {
  if (view === "top") {
    const a = (northAngle * Math.PI) / 180;
    // True south in plan axes is (sin a, −cos a).
    return { direction: [0.0001 * Math.sin(a), 1, 0.0001 * Math.cos(a)], projection: "Orthographic" };
  }
  const [x, y] = CORNERS[view];
  return {
    direction: [x, snapshot ? 0.7 : 1, -y],
    projection: snapshot ? "Perspective" : "Orthographic",
  };
}

/** Where each corner camera stands, in plan x and y. */
const CORNERS: Record<Exclude<View, "top">, readonly [number, number]> = {
  sw: [-1, -1],
  se: [1, -1],
  ne: [1, 1],
  nw: [-1, 1],
};

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/**
 * A corner button's label: the nearest of the eight compass points to the true direction its camera
 * stands in, ties going clockwise. With no north angle it is the corner's own name.
 */
export function cornerLabel(view: Exclude<View, "top">, northAngle = 0): (typeof COMPASS)[number] {
  const a = (northAngle * Math.PI) / 180;
  const [x, y] = CORNERS[view];
  // True east and north in plan axes: north is (−sin a, cos a), east 90° clockwise from it.
  const east = x * Math.cos(a) + y * Math.sin(a);
  const north = -x * Math.sin(a) + y * Math.cos(a);
  const bearing = (((Math.atan2(east, north) * 180) / Math.PI) % 360 + 360) % 360;
  return COMPASS[Math.floor(bearing / 45 + 0.5) % 8]!;
}

/**
 * How much more of the screen the plan box needs in the Top view once it is turned by `northAngle`:
 * the turned box's half-extents against the screen's aspect, over the unturned box's. Exactly 1 with
 * no north angle, so framing tuned for a plan-aligned box carries over to a turned one.
 */
export function turnedTopFit(halfX: number, halfZ: number, northAngle: number, aspect: number): number {
  if (northAngle % 360 === 0) return 1;
  const a = (northAngle * Math.PI) / 180;
  const [c, s] = [Math.abs(Math.cos(a)), Math.abs(Math.sin(a))];
  const fit = (w: number, h: number) => Math.max(w / aspect, h);
  return fit(halfX * c + halfZ * s, halfX * s + halfZ * c) / fit(halfX, halfZ);
}
