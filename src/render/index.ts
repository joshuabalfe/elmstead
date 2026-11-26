import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { writeFileAtomic } from "../io.js";
import type { BuildingModel } from "../schema/schema.js";
import { renderPlan, type PlanOptions } from "./plan.js";
import { svgToPng } from "./png.js";
import { DIFF, PLAIN, snapshot3d } from "./snapshot3d.js";
import type { Issue } from "../checks/issue.js";

/** Writes out/<name>.<storey-id>.plan.{svg,png}; returns the paths written. */
export function renderAll(name: string, model: BuildingModel, outDir: string, opts: PlanOptions): string[] {
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  for (const storey of model.storeys) {
    const svg = renderPlan(model, storey, opts);
    const base = join(outDir, `${name}.${storey.id}.plan`);
    writeFileAtomic(`${base}.svg`, svg);
    writeFileAtomic(`${base}.png`, svgToPng(svg));
    written.push(`${base}.svg`, `${base}.png`);
  }
  return written;
}

/**
 * 3D PNGs of out/<name>.ifc from the viewer. Needs Chromium for Playwright: missing Chromium is a
 * warning (plans still render) with the one-line fix; any other viewer failure is an ERROR.
 */
/** The 3D snapshots, and for a revision (`diff`) the same views again in Diff mode. */
export async function render3d(name: string, outDir: string, { diff = false }: { diff?: boolean } = {}): Promise<{ written: string[]; issues: Issue[] }> {
  try {
    return { written: await snapshot3d(name, outDir, undefined, diff ? [PLAIN, DIFF] : [PLAIN]), issues: [] };
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    if (/Executable doesn't exist|playwright install/i.test(msg)) {
      return {
        written: [],
        issues: [
          {
            level: "WARNING",
            id: `${name}.ifc`,
            message:
              "3D snapshots skipped: Chromium missing — it comes with npm install (@playwright/browser-chromium); if install scripts were skipped, run: npm rebuild @playwright/browser-chromium",
          },
        ],
      };
    }
    return { written: [], issues: [{ level: "ERROR", id: `${name}.ifc`, message: `3D snapshots failed: ${msg.split("\n")[0]}` }] };
  }
}
