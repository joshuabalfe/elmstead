export type Level = "ERROR" | "WARNING" | "INFO";

/** One finding. `id` is the offending element's id (or IFC GlobalId) when there is one. */
export interface Issue {
  level: Level;
  id?: string;
  message: string;
}

export const formatIssue = (i: Issue): string => `${i.level.padEnd(7)} ${i.id ?? "-"}: ${i.message}`;

export const hasErrors = (issues: readonly Issue[]): boolean => issues.some((i) => i.level === "ERROR");
