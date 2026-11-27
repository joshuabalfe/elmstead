/**
 * Viewer benchmark: loads a model in the viewer under headless Chromium and prints JSON with its
 * load time, the textures it uploads and its frame and GPU times while the camera orbits. Not a
 * test: timings vary between machines and runs, so compare two runs on the same machine.
 *
 *   npx tsx scripts/bench-viewer.ts [model] [--gpu] [--runs N] [--root <checkout>] [--query "&a=b"]
 *
 * SwiftShader (software WebGL) by default, which is slow but steady between runs; --gpu uses the
 * machine's GPU. --root benchmarks another checkout's viewer (for example a worktree of main) while
 * serving this checkout's out/, so both see the same IFC.
 */
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { PROJECT_ROOT } from "../src/backend/root.js";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const model = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--")) ?? "elmstead";
const runs = Number(option("--runs") ?? 3);
const root = resolve(option("--root") ?? PROJECT_ROOT);
const query = option("--query") ?? "";
const gpu = flag("--gpu");

// Page code is passed as strings: tsx would otherwise wrap named functions in a helper the page lacks.
/** Records every texture allocation's level-0 size, before any page script runs. */
const TEXTURE_HOOK = `
window.__benchTextures = [];
for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
  const storage = proto.texStorage2D;
  if (storage) proto.texStorage2D = function (target, levels, format, w, h) {
    window.__benchTextures.push({ w, h, levels });
    return storage.apply(this, arguments);
  };
  const image = proto.texImage2D;
  proto.texImage2D = function () {
    const a = arguments;
    if (a[1] === 0) {
      const src = a.length >= 9 ? { width: a[3], height: a[4] } : a[5];
      const w = src?.videoWidth ?? src?.width ?? 0, h = src?.videoHeight ?? src?.height ?? 0;
      window.__benchTextures.push({ w, h, levels: 1 });
    }
    return image.apply(this, a);
  };
}`;

/** Orbits with the right button for 240 frames, timing each frame and a GPU sync after it. */
const ORBIT = `(async () => {
  const canvas = document.querySelector("#container canvas");
  const gl = canvas.getContext("webgl2");
  const frames = [], gpu = [], px = new Uint8Array(4);
  const send = (type, x, y, buttons) => canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, buttons, button: 2, pointerId: 1, pointerType: "mouse", bubbles: true }));
  send("pointerdown", 800, 500, 2);
  let last = performance.now();
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now();
    frames.push(now - last);
    last = now;
    send("pointermove", 800 + Math.sin(i / 10) * 300, 500 + Math.cos(i / 15) * 100, 2);
    const t = performance.now();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // waits for the GPU to finish
    gpu.push(performance.now() - t);
  }
  send("pointerup", 800, 500, 0);
  return { frames, gpu };
})()`;

const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
};
const median = (xs: number[]) => quantile(xs, 0.5);
const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;

process.env.ELMSTEAD_OUT_DIR ??= join(PROJECT_ROOT, "out");
const server = await createServer({
  configFile: join(root, "src/frontend/vite/vite.config.ts"),
  server: { port: 0 },
  logLevel: "error",
});
await server.listen();
const url = server.resolvedUrls?.local[0];
const browser = await chromium.launch({
  args: gpu
    ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"]
    : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  if (!url) throw new Error("viewer dev server did not start");
  const results: Record<string, number | string>[] = [];
  // One warm-up load so Vite's dependency optimisation and the browser's caches don't count.
  for (let run = -1; run < runs; run++) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
    await page.addInitScript(TEXTURE_HOOK);
    const start = Date.now();
    await page.goto(`${url}?model=${encodeURIComponent(model)}${query}`);
    await page.waitForFunction("window.__elmsteadReady || window.__elmsteadError", null, { timeout: 180_000 });
    const loadMs = Date.now() - start;
    const error = await page.evaluate("window.__elmsteadError");
    if (error) throw new Error(`viewer failed: ${error}`);
    const textures = (await page.evaluate("window.__benchTextures")) as { w: number; h: number; levels: number }[];
    const { frames, gpu: gpuMs } = (await page.evaluate(ORBIT)) as { frames: number[]; gpu: number[] };
    await page.close();
    if (run < 0) continue;
    const texels = textures.map((t) => t.w * t.h);
    // RGBA8 with a full mip chain when the texture has more than one level.
    const bytes = textures.reduce((n, t) => n + t.w * t.h * 4 * (t.levels > 1 ? 4 / 3 : 1), 0);
    const largest = textures.reduce((a, t) => (t.w * t.h > a.w * a.h ? t : a), { w: 0, h: 0, levels: 0 });
    results.push({
      loadMs,
      textures: textures.length,
      largestTexture: `${largest.w}x${largest.h}`,
      largestTexels: Math.max(0, ...texels),
      totalTexels: texels.reduce((a, b) => a + b, 0),
      textureMB: round(bytes / 1e6),
      frameMsP50: round(median(frames)),
      frameMsP90: round(quantile(frames, 0.9)),
      gpuMsP50: round(median(gpuMs)),
      gpuMsP90: round(quantile(gpuMs, 0.9)),
    });
  }
  const summary = Object.fromEntries(
    Object.entries(results[0]!).map(([k, v]) => [
      k,
      typeof v === "number" ? median(results.map((r) => r[k] as number)) : v,
    ]),
  );
  console.log(
    JSON.stringify(
      { model, root, renderer: gpu ? "gpu" : "swiftshader", query, runs, median: summary, results },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await server.close();
}
