import type { ItemAttribute } from "@thatopen/fragments";

export interface ElementLabel {
  id: string;
  name: string | null;
}

/** The model id and distinct name an item carries, or null when it names no model element. */
export function elementLabel(data: Record<string, ItemAttribute>): ElementLabel | null {
  const id = data.Tag?.value || data.Name?.value;
  if (typeof id !== "string" || id === "") return null;
  const name = data.LongName?.value ?? data.Name?.value;
  return { id, name: typeof name === "string" && name !== id ? name : null };
}
