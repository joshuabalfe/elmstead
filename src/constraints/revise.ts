/**
 * A revision's constraints, written as edits on its base model's: what the revision no longer
 * keeps is removed with a note saying why, what it re-measures is replaced, and what it adds is
 * added. `reviseConstraints(base, edits)` returns new groups and never changes `base`.
 */
import { RevisionError } from "../schema/ids.js";
import { ConstraintGroupSchema, ConstraintSchema, type Constraint, type ConstraintGroup } from "./schema.js";

export type ConstraintEdit =
  | { op: "remove"; id: string; note: string }
  | { op: "replace"; constraint: Constraint }
  | { op: "addGroups"; groups: ConstraintGroup[] };

/** How a revision's constraints file edited its base's, for the summary line. */
export interface ConstraintEdits {
  removed: number;
  replaced: number;
  added: number;
}

/**
 * Where `reviseConstraints` leaves its counts on the groups it returns. A symbol, so the JSON
 * round-trip the loader validates through drops it; the loader reads it from the module first.
 */
export const CONSTRAINT_EDITS = Symbol("constraint edits");

/** Stop checking a base constraint on this revision. The note says why, as every constraint's note does. */
export const removeConstraint = (id: string, note: string): ConstraintEdit => ({ op: "remove", id, note });
/** Put a constraint in the place of the base's with the same id, e.g. a new measurement from the proposal drawings. */
export const replaceConstraint = (constraint: Constraint): ConstraintEdit => ({ op: "replace", constraint });
/** Add constraints the revision must meet, grouped by storey or room like the base's. */
export const addGroups = (...groups: ConstraintGroup[]): ConstraintEdit => ({ op: "addGroups", groups });

const issuesOf = (r: { error: { issues: { path: PropertyKey[]; message: string }[] } }): string =>
  r.error.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`).join("; ");

function find(groups: ConstraintGroup[], id: string, verb: string): { group: ConstraintGroup; index: number } {
  for (const group of groups) {
    const index = group.constraints.findIndex((c) => c.id === id);
    if (index >= 0) return { group, index };
  }
  throw new RevisionError(id, `cannot ${verb} constraint ${id}: it is not in the base's constraints`);
}

/** New groups: `base` with the edits applied in order. A group left with no constraints is dropped. */
export function reviseConstraints(
  base: readonly ConstraintGroup[],
  edits: readonly ConstraintEdit[],
): ConstraintGroup[] {
  const groups = structuredClone(base) as ConstraintGroup[];
  const counts: ConstraintEdits = { removed: 0, replaced: 0, added: 0 };
  const ids = () => new Set(groups.flatMap((g) => g.constraints.map((c) => c.id)));
  for (const edit of edits) {
    switch (edit.op) {
      case "remove": {
        if (!edit.note.trim())
          throw new RevisionError(edit.id, `cannot remove constraint ${edit.id}: say why in its note`);
        const { group, index } = find(groups, edit.id, "remove");
        group.constraints.splice(index, 1);
        counts.removed++;
        break;
      }
      case "replace": {
        const id = edit.constraint.id;
        const { group, index } = find(groups, id, "replace");
        const r = ConstraintSchema.safeParse(edit.constraint);
        if (!r.success) throw new RevisionError(id, `cannot replace constraint ${id}: ${issuesOf(r)}`);
        group.constraints[index] = structuredClone(edit.constraint);
        counts.replaced++;
        break;
      }
      case "addGroups":
        for (const g of edit.groups) {
          const r = ConstraintGroupSchema.safeParse(g);
          if (!r.success)
            throw new RevisionError(
              g.room ?? g.storey ?? "constraints",
              `cannot add a constraint group: ${issuesOf(r)}`,
            );
          const taken = ids();
          for (const c of g.constraints) {
            if (taken.has(c.id))
              throw new RevisionError(c.id, `cannot add constraint ${c.id}: the id is already in the constraints`);
            taken.add(c.id);
          }
          groups.push(structuredClone(g));
          counts.added += g.constraints.length;
        }
        break;
    }
  }
  const result = groups.filter((g) => g.constraints.length > 0);
  Object.defineProperty(result, CONSTRAINT_EDITS, { value: counts });
  return result;
}
