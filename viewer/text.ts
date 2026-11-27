/**
 * Haloed text drawn onto small canvas textures, at the plan's text scale: the viewer's room,
 * constraint, measurement and hover labels and the plan overlays' dimension figures.
 */
import * as THREE from "three";
import { C, FONT } from "../src/render/style.js";

/** Texture px per plan-SVG px: the SVG is 1 px = 10 mm, so this is 2.5 mm per texel. */
export const LABEL_RESOLUTION = 4;

export interface BillboardLine {
  text: string;
  size: number;
  bold?: boolean;
  /** Baseline offset from the label's anchor, in plan-SVG px (y down). */
  dy: number;
}

/**
 * A label's haloed canvas. `width` and `height` are in plan-SVG px. The lines' baselines sit at
 * their `dy` from the anchor, and the texture's centre sits `centreDy` below the anchor (SVG y
 * down), so a plane centred there puts each baseline exactly at its `dy`.
 */
export function labelTexture(
  lines: BillboardLine[],
  fill: string,
  halo = 3,
): { map: THREE.CanvasTexture; width: number; height: number; centreDy: number } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = (l: BillboardLine) => `${l.bold ? "bold " : ""}${l.size}px "${FONT}", sans-serif`;
  const width = Math.max(...lines.map((l) => ((ctx.font = font(l)), ctx.measureText(l.text).width))) + 2 * halo;
  // Lay the baselines out around the centre, so the texture centres on its anchor.
  const top = Math.min(...lines.map((l) => l.dy - l.size));
  const bottom = Math.max(...lines.map((l) => l.dy + 4));
  const height = bottom - top;
  canvas.width = Math.ceil(width * LABEL_RESOLUTION);
  canvas.height = Math.ceil((height + 2 * halo) * LABEL_RESOLUTION);
  ctx.scale(LABEL_RESOLUTION, LABEL_RESOLUTION);
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  for (const l of lines) {
    ctx.font = font(l);
    if (halo > 0) {
      // A canvas ignores a zero line width, so an unhaloed label skips the stroke instead.
      ctx.lineWidth = halo;
      ctx.strokeStyle = C.paper;
      ctx.strokeText(l.text, width / 2, halo - top + l.dy);
    }
    ctx.fillStyle = fill;
    ctx.fillText(l.text, width / 2, halo - top + l.dy);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, width, height: height + 2 * halo, centreDy: (top + bottom) / 2 };
}
