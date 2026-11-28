import * as THREE from "three";
import { PX_PER_MM } from "../../shared/render/style.js";
import { labelTexture, type BillboardLine } from "./text.js";

/** A sprite that always faces the camera, at the plan's text scale, with a halo so it reads over the model. */
export function billboard(lines: BillboardLine[], fill: string, renderOrder: number, depthTest = false): THREE.Sprite {
  const { map, width, height } = labelTexture(lines, fill);
  // Constraints and measurements depth-test, so a wall or a storey above hides them.
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest, depthWrite: false }));
  sprite.renderOrder = renderOrder;
  const mPerPx = 1 / PX_PER_MM / 1000;
  sprite.scale.set(width * mPerPx, height * mPerPx, 1);
  return sprite;
}
