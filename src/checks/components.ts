import type { BuildingModel } from "../schema/schema.js";
import type { Issue } from "./issue.js";

/**
 * Door and window components: each opening's componentId names a component of its own kind, and a
 * window's glazing bars leave room for glass. Component ids are unique.
 */
export function checkComponents(model: BuildingModel): Issue[] {
  const issues: Issue[] = [];
  const doorList = model.components?.doors ?? [];
  const windowList = model.components?.windows ?? [];
  const seen = new Set<string>();
  for (const c of [...doorList, ...windowList]) {
    if (seen.has(c.id)) issues.push({ level: "ERROR", id: c.id, message: "component id is used twice" });
    seen.add(c.id);
  }
  const doors = new Set(doorList.map((c) => c.id));
  const windows = new Set(windowList.map((c) => c.id));
  const glazing = new Map(windowList.map((c) => [c.id, c.glazing]));
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
      const g = o.kind === "window" ? glazing.get(o.componentId) : undefined;
      if (!g) continue;
      for (const [along, length, n] of [["across", o.width, g.columns.length], ["up", o.height, g.rows.length]] as const) {
        const bars = (n - 1) * g.barWidth;
        if (bars >= length) issues.push({ level: "ERROR", id: o.id, message: `${n} panes ${along} need ${bars} mm of ${g.barWidth} mm bars, but the window is only ${length} mm ${along === "across" ? "wide" : "high"}` });
      }
    }
  }
  return issues;
}
