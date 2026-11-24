export const VIEWS = ["sw", "se", "ne", "nw", "top"] as const;
export type View = (typeof VIEWS)[number];

/** The requested camera view, falling back to the plan-like top view for anything unknown. */
export const parseView = (value: string | null): View => (VIEWS.includes(value as View) ? (value as View) : "top");

export interface CameraForView {
  direction: readonly [number, number, number];
  projection: "Orthographic" | "Perspective";
}

/**
 * Interactive corner views are true isometric: equal X, Y and Z direction components behind an
 * orthographic camera foreshorten all three axes equally. Snapshots keep the lower perspective
 * corner cameras that the rendered 3D PNGs have always used. Top is an orthographic plan view.
 */
export function cameraForView(view: View, snapshot: boolean): CameraForView {
  if (view === "top") return { direction: [0, 1, 0.0001], projection: "Orthographic" };
  const horizontal: Record<Exclude<View, "top">, readonly [number, number]> = {
    sw: [-1, 1],
    se: [1, 1],
    ne: [1, -1],
    nw: [-1, -1],
  };
  const [x, z] = horizontal[view];
  return {
    direction: [x, snapshot ? 0.7 : 1, z],
    projection: snapshot ? "Perspective" : "Orthographic",
  };
}
