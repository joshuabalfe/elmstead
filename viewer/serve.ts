import { isAbsolute, relative, resolve } from "node:path";

/** Resolve a request path inside dir, or undefined when it escapes dir or has malformed encoding. */
export function confinedPath(dir: string, encodedPath: string): string | undefined {
  let path: string;
  try {
    path = decodeURIComponent(encodedPath);
  } catch {
    return undefined;
  }
  const file = resolve(dir, path);
  const rel = relative(dir, file);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return undefined;
  return file;
}