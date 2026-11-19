import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BuildingModel } from "../schema/schema.js";
import { renderPlan, type PlanOptions } from "./plan.js";
import { svgToPng } from "./png.js";

/** Writes out/<name>.<storey-id>.plan.{svg,png}; returns the paths written. */
export function renderAll(name: string, model: BuildingModel, outDir: string, opts: PlanOptions): string[] {
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const storey of model.storeys) {
    const svg = renderPlan(model, storey, opts);
    const base = join(outDir, `${name}.${storey.id}.plan`);
    writeFileSync(`${base}.svg`, svg);
    writeFileSync(`${base}.png`, svgToPng(svg));
    written.push(`${base}.svg`, `${base}.png`);
  }
  return written;
}
