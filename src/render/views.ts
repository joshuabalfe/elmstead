/** The camera views the viewer offers and the 3D snapshots render, in snapshot order. */
export const VIEWS = ["sw", "se", "ne", "nw", "top"] as const;
export type View = (typeof VIEWS)[number];
