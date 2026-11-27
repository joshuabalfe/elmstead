/** Recognising the IFC's presentation colours on the viewer's materials, apart so it can be tested. */
import * as THREE from "three";
import { STYLES } from "../../shared/ifc/styles.js";

/** Which of the IFC's presentation colours (src/shared/ifc/styles.ts) a colour is, if any. */
export function styleOfColour(c: THREE.Color): keyof typeof STYLES | undefined {
  let best: keyof typeof STYLES | undefined;
  let bestDist = 0.02; // the IFC colours survive the round trip to within about 1/255
  for (const [name, { rgb }] of Object.entries(STYLES) as [
    keyof typeof STYLES,
    (typeof STYLES)[keyof typeof STYLES],
  ][]) {
    const ifc = new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
    const d = Math.hypot(ifc.r - c.r, ifc.g - c.g, ifc.b - c.b);
    if (d < bestDist) [best, bestDist] = [name, d];
  }
  return best;
}
