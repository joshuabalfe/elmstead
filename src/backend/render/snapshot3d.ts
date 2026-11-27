/**
 * 3D snapshots of the IFC itself (not the model): starts the viewer (viewer/) with Vite, opens it in
 * headless Chromium via Playwright and saves one PNG per view. Software WebGL, so no GPU needed.
 */
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { createServer } from "vite";
import { writeFileAtomic } from "../io.js";
import { PROJECT_ROOT } from "../root.js";
import { VIEWS, type View } from "../../shared/render/views.js";

// Set by viewer/main.ts.
declare global {
  interface Window {
    __elmsteadReady?: boolean;
    __elmsteadError?: string;
  }
}

/** A set of snapshots: what the file names gain (`.3d-diff-sw.png`) and the URL parameters that draw it. */
export interface SnapshotVariant {
  suffix: string;
  query: string;
}

export const PLAIN: SnapshotVariant = { suffix: "", query: "" };
/** A revision drawn in Diff mode. */
export const DIFF: SnapshotVariant = { suffix: "diff-", query: "&diff=1" };

export async function snapshot3d(
  name: string,
  outDir: string,
  views: readonly View[] = VIEWS,
  variants: readonly SnapshotVariant[] = [PLAIN],
): Promise<string[]> {
  const server = await createServer({
    configFile: join(PROJECT_ROOT, "src/frontend/vite/vite.config.ts"),
    server: { port: 0 },
    logLevel: "error",
  });
  let browser: Browser | undefined;
  const written: string[] = [];
  try {
    await server.listen();
    const url = server.resolvedUrls?.local[0];
    if (!url) throw new Error("viewer dev server did not start");
    browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const variant of variants)
      for (const view of views) {
        await page.goto(`${url}?model=${encodeURIComponent(name)}&view=${view}&snapshot=1${variant.query}`);
        await page.waitForFunction(() => window.__elmsteadReady || window.__elmsteadError, null, { timeout: 60_000 });
        const failed = await page.evaluate(() => window.__elmsteadError);
        if (failed || errors.length) throw new Error(`viewer failed: ${failed ?? errors.join("; ")}`);
        const path = join(outDir, `${name}.3d-${variant.suffix}${view}.png`);
        writeFileAtomic(path, await page.screenshot());
        written.push(path);
      }
  } finally {
    await browser?.close();
    await server.close();
  }
  return written;
}
