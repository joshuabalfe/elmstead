import type { Issue } from "../checks/issue.js";
import type { BuildingModel } from "../schema/schema.js";
import { ConstraintError, indexModel, lookup, measureConstraint, type ModelIndex, type Scope } from "./resolve.js";
import { DEFAULT_TOLERANCE, type ConstraintGroup } from "./schema.js";

export interface ConstraintsReport {
  issues: Issue[];
  met: number;
  total: number;
}

/** The group's scope, or an ERROR against the scope id when the model has no such storey or room. */
function scopeOf(ix: ModelIndex, group: ConstraintGroup): Scope | Issue {
  const [kind, id] = group.storey !== undefined ? (["storey", group.storey] as const) : (["room", group.room!] as const);
  try {
    return { kind, id, storey: lookup(ix, id, [kind], kind).storey };
  } catch (e) {
    if (!(e instanceof ConstraintError)) throw e;
    return { level: "ERROR", id, message: `constraint group's ${kind}: ${e.message}` };
  }
}

/**
 * Measure every constraint against the model. Each one that cannot be measured or is not met is an
 * ERROR against its id, ending with its group's scope; the others still run.
 */
export function checkConstraints(model: BuildingModel, groups: readonly ConstraintGroup[]): ConstraintsReport {
  const ix = indexModel(model);
  const issues: Issue[] = [];
  let met = 0;
  let total = 0;
  for (const group of groups) {
    total += group.constraints.length;
    const scope = scopeOf(ix, group);
    if ("level" in scope) {
      issues.push(scope);
      continue;
    }
    for (const c of group.constraints) {
      const tolerance = c.tolerance ?? DEFAULT_TOLERANCE;
      let measured: number;
      try {
        measured = measureConstraint(ix, c, scope);
      } catch (e) {
        if (!(e instanceof ConstraintError)) throw e;
        issues.push({ level: "ERROR", id: c.id, message: `${e.message} (${scope.id})` });
        continue;
      }
      if (Math.abs(measured - c.distance) <= tolerance) met++;
      else issues.push({ level: "ERROR", id: c.id, message: `is ${measured} mm, should be ${c.distance} ±${tolerance} mm (${scope.id})` });
    }
  }
  return { issues, met, total };
}
