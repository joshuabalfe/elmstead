/** Drawing style in one place. Sizes are SVG px at the base scale (see PX_PER_MM). */
export const PX_PER_MM = 0.1; // 1 px = 10 mm, i.e. 1:100 at roughly 254 dpi when exported at 2×
export const PNG_ZOOM = 2;
export const FONT = "DejaVu Sans";
/** Height above the storey floor (mm) at which the plan is cut. Openings wholly above or below it are not cut. */
export const CUT_HEIGHT = 1200;

export const C = {
  paper: "#ffffff",
  ink: "#1a1a1a",
  wall: "#2b2b2b",
  room: "#f3efe6",
  slab: "#9a9a9a",
  opening: "#1a1a1a",
  glass: "#3a7bd5",
  dim: "#5a5a5a",
  id: "#c0392b",
  // Stairs. Must stay clear of wall, room and paper: the plan-versus-3D test classifies a pixel by
  // those three and compares only the pixels it recognises, so stair pixels must not be mistaken
  // for one of them (see tests/support/plan-vs-3d.ts).
  stair: "#5c8a55",
};

/** Room label font sizes (px) and baselines relative to the room's centroid. */
export const ROOM_LABEL = { name: { size: 13, dy: -4 }, area: { size: 11, dy: 12 } };

export const MARGIN = { top: 70, right: 110, bottom: 120, left: 60 };
