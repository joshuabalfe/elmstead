/**
 * Presentation colours (sRGB 0–1, transparency 0–1). Pure presentation: they make walls, slabs,
 * doors, glazing and glazing bars distinguishable in any IFC viewer and carry no building meaning. In a module of
 * their own so the viewer can recognise them without loading the IFC writer.
 */
export const STYLES = {
  wall: { rgb: [0.91, 0.89, 0.85], transparency: 0 },
  slab: { rgb: [0.55, 0.55, 0.55], transparency: 0 },
  door: { rgb: [0.61, 0.42, 0.26], transparency: 0 },
  glazing: { rgb: [0.5, 0.7, 0.9], transparency: 0.5 },
  frame: { rgb: [0.98, 0.98, 0.97], transparency: 0 }, // glazing bars, painted white
} as const;
export type StyleName = keyof typeof STYLES;
