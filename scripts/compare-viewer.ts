/**
 * Before/after screenshots of the viewer's plan style: captures fixed views from two checkouts'
 * viewers, both serving this checkout's out/, and writes for each view a side-by-side image
 * (before | after | difference) and its mismatch ratio, with an index.html to review them. Not a
 * test: antialiasing differs between renderers, so read the images rather than assert on them.
 *
 *   npx tsx scripts/compare-viewer.ts --before <checkout> [--after <checkout>] [--out <dir>] [model]
 *
 * --after defaults to this checkout and --out to out/compare-viewer. The views are the top view and
 * two corners of the whole building, the top view of each storey alone, and close-ups of a window,
 * a door swing and a dimension figure on the storey with the most openings.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type Browser } from "playwright";
import { createServer } from "vite";
import { faceOffsets, wallHeight, wallPoint } from "../src/geometry/wall.js";
import { PROJECT_ROOT } from "../src/root.js";
import type { BuildingModel } from "../src/schema/schema.js";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const model = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--")) ?? "elmstead";
const before = option("--before");
if (!before) throw new Error("--before <checkout> is required");
const roots = { before: resolve(before), after: resolve(option("--after") ?? PROJECT_ROOT) };
const outDir = resolve(option("--out") ?? join(PROJECT_ROOT, "out", "compare-viewer"));
const outIfc = join(PROJECT_ROOT, "out");
process.env.ELMSTEAD_OUT_DIR ??= outIfc;

/** The views to compare: a name and the viewer query that shows it. */
function views(m: BuildingModel): { name: string; query: string }[] {
  const list = [
    { name: "top-all", query: "&view=top" },
    { name: "sw-all", query: "&view=sw" },
    { name: "ne-all", query: "&view=ne" },
    ...m.storeys.map((s) => ({ name: `top-${s.id}`, query: `&view=top&storeys=${s.id}` })),
  ];
  // Close-ups on the storey with the most openings, shown alone so the storeys above don't cover it.
  const storey = [...m.storeys].sort((a, b) => b.openings.length - a.openings.length)[0];
  if (!storey) return list;
  const scene = (p: { x: number; y: number }, y: number) => [p.x / 1000, y / 1000, -p.y / 1000];
  const look = (name: string, at: number[], up: number) => {
    const eye = [at[0]! + 0.3, at[1]! + up, at[2]! + 0.6];
    list.push({ name, query: `&storeys=${storey.id}&camera=${[...eye, ...at].map((n) => n.toFixed(3)).join(",")}` });
  };
  const wallOf = (id: string) => storey.walls.find((w) => w.id === id);
  const mid = (o: (typeof storey.openings)[number]) => {
    const w = wallOf(o.wallId)!;
    const { left, right } = faceOffsets(w);
    return { w, p: wallPoint(w, o.offsetAlongWall + o.width / 2, (left + right) / 2) };
  };
  const window = storey.openings.find((o) => o.kind === "window" && wallOf(o.wallId) && !wallOf(o.wallId)!.profile);
  if (window) {
    const { w, p } = mid(window);
    look("close-window", scene(p, storey.elevation + wallHeight(w)), 2.2);
  }
  const door = storey.openings.find((o) => o.kind === "door" && !o.doorway && wallOf(o.wallId));
  if (door) {
    const { p } = mid(door);
    look("close-door-swing", scene(p, storey.elevation), 2.4);
  }
  // The overall east–west dimension runs 400 mm south of the storey's extent, its figure mid-way.
  const xs = storey.walls.flatMap((w) => [w.start.x, w.end.x]);
  const ys = storey.walls.flatMap((w) => [w.start.y, w.end.y]);
  const ceiling = Math.max(0, ...storey.walls.map((w) => wallHeight(w)));
  if (xs.length)
    look(
      "close-dimension",
      scene({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: Math.min(...ys) - 400 }, storey.elevation + ceiling),
      2.2,
    );
  return list;
}

/** Captures every view from one checkout's viewer as PNG buffers. */
async function capture(
  browser: Browser,
  root: string,
  list: { name: string; query: string }[],
): Promise<Map<string, Buffer>> {
  const server = await createServer({
    configFile: join(root, "viewer/vite.config.ts"),
    server: { port: 0 },
    logLevel: "error",
  });
  const shots = new Map<string, Buffer>();
  try {
    await server.listen();
    const url = server.resolvedUrls?.local[0];
    if (!url) throw new Error(`viewer dev server did not start for ${root}`);
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
    for (const v of list) {
      // Snapshot mode hides the UI and signals readiness; plan style and labels are forced back on.
      await page.goto(`${url}?model=${encodeURIComponent(model)}&snapshot=1&style=plan&labels=1${v.query}`);
      await page.waitForFunction("window.__elmsteadReady || window.__elmsteadError", null, { timeout: 180_000 });
      const error = await page.evaluate("window.__elmsteadError");
      if (error) throw new Error(`viewer failed on ${v.name} (${root}): ${error}`);
      shots.set(v.name, await page.screenshot());
    }
    await page.close();
  } finally {
    await server.close();
  }
  return shots;
}

/**
 * Compares two PNGs in the browser: returns the share of pixels where any channel differs by more
 * than 16 of 255, and a strip of before | after | difference (red where they differ, faded
 * greyscale of `after` elsewhere).
 */
const DIFF = `async ([a, b]) => {
  const load = async (src) => { const i = new Image(); i.src = src; await i.decode(); return i; };
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  const w = ia.width, h = ia.height;
  const pixels = (img) => { const c = new OffscreenCanvas(w, h); const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, w, h); };
  const pa = pixels(ia), pb = pixels(ib);
  const diff = new ImageData(w, h);
  let differing = 0;
  for (let i = 0; i < pa.data.length; i += 4) {
    const d = Math.max(Math.abs(pa.data[i] - pb.data[i]), Math.abs(pa.data[i + 1] - pb.data[i + 1]), Math.abs(pa.data[i + 2] - pb.data[i + 2]));
    if (d > 16) { differing++; diff.data.set([255, 0, 0, 255], i); }
    else { const g = 200 + (pb.data[i] + pb.data[i + 1] + pb.data[i + 2]) / 15; diff.data.set([g, g, g, 255], i); }
  }
  const strip = document.createElement("canvas");
  strip.width = w * 3; strip.height = h;
  const x = strip.getContext("2d");
  x.drawImage(ia, 0, 0); x.drawImage(ib, w, 0); x.putImageData(diff, 2 * w, 0);
  return { ratio: differing / (w * h), strip: strip.toDataURL("image/png") };
}`;

const json = JSON.parse(readFileSync(join(outIfc, `${model}.building.json`), "utf8")) as BuildingModel;
const list = views(json);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  const a = await capture(browser, roots.before, list);
  const b = await capture(browser, roots.after, list);
  const page = await browser.newPage();
  const rows: { name: string; ratio: number }[] = [];
  for (const v of list) {
    const dataUrl = (buf: Buffer) => `data:image/png;base64,${buf.toString("base64")}`;
    const { ratio, strip } = (await page.evaluate(
      `(${DIFF})(${JSON.stringify([dataUrl(a.get(v.name)!), dataUrl(b.get(v.name)!)])})`,
    )) as { ratio: number; strip: string };
    writeFileSync(join(outDir, `${v.name}.png`), Buffer.from(strip.split(",")[1]!, "base64"));
    rows.push({ name: v.name, ratio });
  }
  const html = [
    "<!doctype html><meta charset=utf-8><title>Viewer comparison</title>",
    "<style>body{font:14px sans-serif;margin:16px}img{width:100%;border:1px solid #ccc}h2{font-size:15px;margin:24px 0 6px}</style>",
    `<h1>${model}: before | after | difference</h1><p>before: ${roots.before}<br>after: ${roots.after}</p>`,
    ...rows.map((r) => `<h2>${r.name}: ${(r.ratio * 100).toFixed(2)}% of pixels differ</h2><img src="${r.name}.png">`),
  ].join("\n");
  writeFileSync(join(outDir, "index.html"), html);
  console.log(
    JSON.stringify(
      {
        model,
        before: roots.before,
        after: roots.after,
        out: outDir,
        mismatch: Object.fromEntries(rows.map((r) => [r.name, Number(r.ratio.toFixed(4))])),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
