export const VIEWS = ["sw", "se", "ne", "nw", "top"] as const;
export type View = (typeof VIEWS)[number];

/** The requested camera view, falling back to the plan-like top view for anything unknown. */
export const parseView = (value: string | null): View => (VIEWS.includes(value as View) ? (value as View) : "top");