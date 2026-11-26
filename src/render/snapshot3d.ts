/**
 * 3D snapshots of the IFC itself (not the model): starts the viewer (viewer/) with Vite, opens it in
 * headless Chromium via Playwright and saves one PNG per view. Software WebGL, so no GPU needed.
 */
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { createServer } from "vite";
import { writeFileAtomic } from "../io.js";
import { PROJECT_ROOT } from "../root.js";
import { VIEWS, type View } from "./views.js";

// Set by viewer/main.ts.
declare global {
  interface Window {
    __elmsteadReady?: boolean;
    __elmsteadError?: string;
  }
}

export async function snapshot3d(name: string, outDir: string, views: readonly View[] = VIEWS): Promise<string[]> {
  const server = await createServer({ configFile: join(PROJECT_ROOT, "viewer/vite.config.ts"), server: { port: 0 }, logLevel: "error" });
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
    for (const view of views) {
      await page.goto(`${url}?model=${encodeURIComponent(name)}&view=${view}&snapshot=1`);
      await page.waitForFunction(() => window.__elmsteadReady || window.__elmsteadError, null, { timeout: 60_000 });
      const failed = await page.evaluate(() => window.__elmsteadError);
      if (failed || errors.length) throw new Error(`viewer failed: ${failed ?? errors.join("; ")}`);
      const path = join(outDir, `${name}.3d-${view}.png`);
      writeFileAtomic(path, await page.screenshot());
      written.push(path);
    }
  } finally {
    await browser?.close();
    await server.close();
  }
  return written;
}