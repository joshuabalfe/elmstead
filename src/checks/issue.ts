import type { z } from "zod";

export type Level = "ERROR" | "WARNING" | "INFO";

/** One finding. `id` is the offending element's id (or IFC GlobalId) when there is one. */
export interface Issue {
  level: Level;
  id?: string;
  message: string;
}

export const formatIssue = (i: Issue): string => `${i.level.padEnd(7)} ${i.id ?? "-"}: ${i.message}`;

export const hasErrors = (issues: readonly Issue[]): boolean => issues.some((i) => i.level === "ERROR");

/** "storeys.0.walls.3.thickness: must be > 0", attributed to the nearest enclosing element id. */
export function schemaIssue(root: unknown, issue: z.core.$ZodIssue): Issue {
  let node: unknown = root;
  let id: string | undefined;
  for (const key of issue.path) {
    if (node && typeof node === "object") {
      node = (node as Record<PropertyKey, unknown>)[key as PropertyKey];
      const maybeId = node && typeof node === "object" ? (node as { id?: unknown }).id : undefined;
      if (typeof maybeId === "string") id = maybeId;
    }
  }
  return { level: "ERROR", ...(id ? { id } : {}), message: `schema: ${issue.path.join(".") || "(root)"}: ${issue.message}` };
}
