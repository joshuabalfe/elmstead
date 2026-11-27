import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Repository root, resolved from this module so commands work from any working directory. */
export const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** Output directory: ELMSTEAD_OUT_DIR when set, otherwise out/ at the project root. */
export const outDir = (): string =>
  process.env.ELMSTEAD_OUT_DIR ? resolve(process.env.ELMSTEAD_OUT_DIR) : join(PROJECT_ROOT, "out");
