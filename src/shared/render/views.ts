/** The plan-corner views the 3D snapshots render, in snapshot order, plus Top. */
export const VIEWS = ["sw", "se", "ne", "nw", "top"] as const;
export type View = (typeof VIEWS)[number];

/** The true-north camera snaps the viewer offers, in compass order. */
export const CARDINALS = ["n", "e", "s", "w"] as const;
export type CardinalView = (typeof CARDINALS)[number];

/** The flat elevations the viewer offers; front is the plan's south side. */
export const ELEVATIONS = ["front", "back", "left", "right"] as const;
export type ElevationView = (typeof ELEVATIONS)[number];

/** Every value `?view=` accepts: corner snapshots, cardinal snaps and flat elevations. */
export const CAMERA_VIEWS = [...VIEWS, ...CARDINALS, ...ELEVATIONS] as const;
export type CameraView = (typeof CAMERA_VIEWS)[number];

export const CARDINAL_NAMES: Record<CardinalView, string> = {
  n: "north",
  e: "east",
  s: "south",
  w: "west",
};

export const ELEVATION_NAMES: Record<ElevationView, string> = {
  front: "Front",
  back: "Back",
  left: "Left",
  right: "Right",
};
