import type { BuildingModel } from "../schema/schema.js";
import type { Issue } from "./issue.js";

/**
 * Door and window components: each opening's componentId names a component of its own kind, a
 * door's frame leaves room for its leaf, and a window's frame and glazing bars leave room for
 * glass. Id uniqueness is in checkIds.
 */
export function checkComponents(model: BuildingModel): Issue[] {
  const issues: Issue[] = [];
  const doorList = model.components?.doors ?? [];
  const windowList = model.components?.windows ?? [];
  const doors = new Set(doorList.map((c) => c.id));
  const windows = new Set(windowList.map((c) => c.id));
  const doorDesigns = new Map(doorList.map((c) => [c.id, c]));
  const windowDesigns = new Map(windowList.map((c) => [c.id, c]));
  for (const storey of model.storeys) {
    for (const o of storey.openings) {
      if (o.componentId === undefined) continue;
      const own = o.kind === "door" ? doors : windows;
      const other = o.kind === "door" ? windows : doors;
      if (!own.has(o.componentId)) {
        const why = other.has(o.componentId) ? `is a ${o.kind === "door" ? "window" : "door"} component` : "is not in components";
        issues.push({ level: "ERROR", id: o.id, message: `componentId ${o.componentId} ${why}` });
        continue;
      }
      if (o.kind === "door") {
        const design = doorDesigns.get(o.componentId);
        const frame = design?.frame?.width ?? 0;
        for (const [along, length] of [["across", o.width], ["up", o.height]] as const) {
          const total = along === "across" ? 2 * frame : frame;
          if (total < length) continue;
          issues.push({ level: "ERROR", id: o.id, message: `${total} mm of frame leaves no leaf ${along}: the door is only ${length} mm ${along === "across" ? "wide" : "high"}` });
        }
        continue;
      }
      const design = windowDesigns.get(o.componentId);
      if (!design) continue;
      const frame = 2 * (design.frame?.width ?? 0);
      for (const [along, length, n] of [["across", o.width, design.glazing?.columns.length ?? 1], ["up", o.height, design.glazing?.rows.length ?? 1]] as const) {
        const bars = (n - 1) * (design.glazing?.barWidth ?? 0);
        if (frame + bars < length) continue;
        const parts = [frame ? `${frame} mm of frame` : "", bars ? `${bars} mm of bars between ${n} panes` : ""].filter(Boolean).join(" and ");
        issues.push({ level: "ERROR", id: o.id, message: `${parts} leave no glass ${along}: the window is only ${length} mm ${along === "across" ? "wide" : "high"}` });
      }
    }
  }
  return issues;
}
