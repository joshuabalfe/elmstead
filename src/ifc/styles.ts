/**
 * Presentation colours (sRGB 0–1, transparency 0–1). Pure presentation: they make walls, slabs,
 * doors, glazing and glazing bars distinguishable in any IFC viewer and carry no building meaning. In a module of
 * their own so the viewer can recognise them without loading the IFC writer.
 */
export const STYLES = {
  wall: { rgb: [0.91, 0.89, 0.85], transparency: 0 },
  slab: { rgb: [0.55, 0.55, 0.55], transparency: 0 },
  // External ground slabs. Distinct from `slab` so the viewer can paint ground in 3D and use the
  // ground floor fill in plan style.
  ground: { rgb: [0.47, 0.56, 0.38], transparency: 0 },
  door: { rgb: [0.61, 0.42, 0.26], transparency: 0 },
  glazing: { rgb: [0.5, 0.7, 0.9], transparency: 0.5 },
  frame: { rgb: [0.98, 0.98, 0.97], transparency: 0 }, // glazing bars, painted white
  // Stair flights and landings. The viewer nearest-matches materials against this table and repaints
  // what it recognises, so a stair must stay well clear of every entry — above all `wall`, whose tops
  // it would paint charcoal, and `slab`, whose tops it would discard (see styleOf in viewer/main.ts).
  stair: { rgb: [0.36, 0.54, 0.33], transparency: 0 },
} as const;
export type StyleName = keyof typeof STYLES;
