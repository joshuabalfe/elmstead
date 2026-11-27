/**
 * Revisions in the viewer: `/models.json` lists every IFC in out/, and a revision's name is
 * `<model>@<revision>`. These group the names by model for the model and revision pickers.
 */

/** A model's built outputs: whether the base is built, and its revisions in name order. */
export interface ModelGroup {
  base: boolean;
  revisions: string[];
}

/** `elmstead@rear-extension` → model `elmstead`, revision `rear-extension`; a base has none. */
export function splitName(name: string): { model: string; revision: string | null } {
  const at = name.indexOf("@");
  return at < 0 ? { model: name, revision: null } : { model: name.slice(0, at), revision: name.slice(at + 1) };
}

export const joinName = (model: string, revision: string | null): string =>
  revision === null ? model : `${model}@${revision}`;

/** The names grouped by model, models in name order. A model with only revisions built is listed too. */
export function groupModels(names: readonly string[]): Map<string, ModelGroup> {
  const groups = new Map<string, ModelGroup>();
  for (const name of [...names].sort()) {
    const { model, revision } = splitName(name);
    const group = groups.get(model) ?? { base: false, revisions: [] };
    if (revision === null) group.base = true;
    else group.revisions.push(revision);
    groups.set(model, group);
  }
  return new Map([...groups].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** What a model's name opens as: the base when it is built, otherwise its first revision. */
export function defaultName(model: string, group: ModelGroup): string {
  return group.base || !group.revisions.length ? model : joinName(model, group.revisions[0]!);
}

/**
 * The revision picker's entry next to `current` (null for Existing), one step in `direction`;
 * undefined past either end. Existing is skipped when the base is not built. No wrap.
 */
export function stepRevision(group: ModelGroup, current: string | null, direction: 1 | -1): string | null | undefined {
  const entries: (string | null)[] = [...(group.base ? [null] : []), ...group.revisions];
  const i = entries.indexOf(current);
  const next = i + direction;
  return i < 0 || next < 0 || next >= entries.length ? undefined : entries[next];
}
