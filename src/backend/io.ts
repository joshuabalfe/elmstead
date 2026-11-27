import { renameSync, unlinkSync, writeFileSync } from "node:fs";

/** Write through a temporary file in the same directory, then rename, so the old file survives a failure. */
export function writeFileAtomic(path: string, data: string | Uint8Array): void {
  const temp = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temp, data);
    renameSync(temp, path);
  } catch (e) {
    try {
      unlinkSync(temp);
    } catch {
      // The temp file may never have been created.
    }
    throw e;
  }
}
