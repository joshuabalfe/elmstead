import {
  CAMERA_VIEWS,
  type CameraView,
  type CardinalView,
  type ElevationView,
  type View,
} from "../../shared/render/views.js";

/** The requested camera view, falling back to the plan-like top view for anything unknown. */
export const parseView = (value: string | null): CameraView =>
  CAMERA_VIEWS.includes(value as CameraView) ? (value as CameraView) : "top";

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
 * Camera snaps are axonometric: the N/W/E/S snaps stand on the model's true axes and turn with
 * `northAngle`, while the flat Front/Back/Left/Right elevations stay level and follow the model's
 * `frontAngle`. Both angles are degrees counter-clockwise from plan +y. The plan-corner ids keep the
 * snapshot cameras the 3D PNGs have always used. Top looks straight down, turned so true north is
 * up the screen. The scene has plan +y along −Z.
 */
export function cameraForView(view: CameraView, snapshot: boolean, northAngle = 0, frontAngle = 180): CameraForView {
  if (view === "top") {
    const a = (northAngle * Math.PI) / 180;
    // True south in plan axes is (sin a, −cos a).
    return { direction: [0.0001 * Math.sin(a), 1, 0.0001 * Math.cos(a)], projection: "Orthographic" };
  }
  if (view === "n" || view === "e" || view === "s" || view === "w") {
    const a = (northAngle * Math.PI) / 180;
    const [x, y] = SNAP_DIRECTIONS[view];
    // True north is (−sin a, cos a) in plan axes; east is 90° clockwise from it.
    const planX = x * Math.cos(a) - y * Math.sin(a);
    const planY = x * Math.sin(a) + y * Math.cos(a);
    return {
      direction: [Math.SQRT2 * planX, snapshot ? 0.7 : 1, -Math.SQRT2 * planY],
      projection: snapshot ? "Perspective" : "Orthographic",
    };
  }
  if (view === "front" || view === "back" || view === "left" || view === "right") {
    const a = (frontAngle * Math.PI) / 180;
    const [frontX, frontY] = [-Math.sin(a), Math.cos(a)];
    const flat: Record<ElevationView, readonly [number, number]> = {
      front: [frontX, -frontY],
      back: [-frontX, frontY],
      left: [frontY, frontX],
      right: [-frontY, -frontX],
    };
    const nudge = (n: number) => (Math.abs(n) < 1e-12 ? 0 : n);
    const [x, z] = flat[view];
    return { direction: [nudge(x), 0, nudge(z)], projection: "Orthographic" };
  }
  const [x, y] = CORNERS[view];
  return {
    direction: [x, snapshot ? 0.7 : 1, -y],
    projection: snapshot ? "Perspective" : "Orthographic",
  };
}

/** Where each plan-corner camera stands, in plan x and y. */
const CORNERS: Record<Exclude<View, "top">, readonly [number, number]> = {
  sw: [-1, -1],
  se: [1, -1],
  ne: [1, 1],
  nw: [-1, 1],
};

/** Where each true-axis snap stands, in plan x and y before the north angle turns it. */
const SNAP_DIRECTIONS: Record<CardinalView, readonly [number, number]> = {
  n: [0, 1],
  e: [1, 0],
  s: [0, -1],
  w: [-1, 0],
};

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
