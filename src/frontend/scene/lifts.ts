/** Heights above a storey's ceiling, in millimetres, shared by the labels and the storey sweep. */

/** Height (mm) above the ceiling at which the labels are laid, clear of the wall tops. */
export const LABEL_LIFT = 10;

/** Height (mm) above the wall tops of the plan's walls, door gaps and windows; below the labels. */
export const WALL_TOP_LIFT = 5;

/**
 * Height (mm) a storey's floor plane sits above its own elevation. The storey below draws its wall
 * tops 5 mm and its labels 10 mm above its ceiling, which is this storey's elevation, so a floor
 * plane at exactly the elevation would pass beneath them and they would show through it.
 */
export const FLOOR_LIFT = LABEL_LIFT + 10;
