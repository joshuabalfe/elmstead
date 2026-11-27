---
name: inspect-the-rendered-output
description: Look at what the pipeline produced for a model, or for any change to the pipeline, using the plan PNG, the 3D PNGs and the viewer in headless Chromium. Use after editing a model, a revision or the renderer, before saying a change works, or when asked "does it look right", "show me", "check the plan", "check it in 3D" or "check the diff". Also use to see a viewer state that `render` does not write, such as plan style, one storey, `?ids=1`, `?constraints=1` or a close-up.
---

# Inspect the rendered output

Passing checks and tests does not mean the model looks right. The plan, the IFC and the viewer are
three renderings of one model, and each can be wrong alone. Look at them. You can read PNGs with the
Read tool.

## 1. Produce the outputs

```sh
npm run all models/<model>             # build, then render if the build passed
npm run all -- --ids models/<model>    # the same, with every element's id on the plan
```

- `all` and `render` write to `out/` (git-ignored; never edit it). Files are named after the model:
  `out/<name>.<storey-id>.plan.png`, `out/<name>.3d-{sw,se,ne,nw,top}.png`.
- `render` shows nothing new without a fresh `build`: its 3D pictures come from the IFC the last
  `build` wrote. Use `all`.
- A revision is a path: `npm run all models/<model>/revisions/<revision>.ts`. Its outputs are named
  `<name>@<revision>`, and it also gets `.3d-diff-{view}.png` pictures. **Build the base model
  first**, or the Diff pictures draw with a warning and miss the removed elements.
- `--ids` labels each element with its id on the plan, which is the id to use when asking for or
  making an edit. Put flags after `--` so npm passes them on. `--no-3d` skips the 3D pictures (about 5 s).

## 2. Read the pictures, in this order

1. **Plan PNG, per storey.** What the model says, drawn directly from the JSON. Check walls, door
   swings, window symbols, room fills and names, dimensions, and anything you added.
2. **3D PNGs.** What *the IFC* says, so what any other IFC viewer will show. These are in the IFC's
   own colours (`?style=ifc`), not the plan's. Check that openings are cut, doors and glazing are
   in place, and a new element is there and the right colour.
3. **Diff PNGs (revisions).** Added is green, changed is yellow, removed is red ghosts. Check the
   revision changes what you meant and nothing else.

Compare 1 with 2: they should show the same building. Where they differ is where to look.

## 3. See a state `render` does not write

The viewer's default outside snapshots is plan style: plan colours, room labels, wall-top symbols.
To screenshot any state, run this from the repo root (the viewer is served by Vite, the page driven
by Playwright's Chromium, both already installed by `npm install`). `ELMSTEAD_OUT_DIR` points the
viewer at another folder of outputs; leave it unset to use `out/`.

```sh
node --input-type=module -e '
import { chromium } from "playwright";
import { createServer } from "vite";
const [query, file] = process.argv.slice(1);
const server = await createServer({ configFile: "viewer/vite.config.ts", server: { port: 0 }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${server.resolvedUrls.local[0]}?${query}`);
  await page.waitForFunction(() => window.__elmsteadReady || window.__elmsteadError, null, { timeout: 60000 });
  const failed = await page.evaluate(() => window.__elmsteadError);
  if (failed || errors.length) throw new Error(`viewer failed: ${failed ?? errors.join("; ")}`);
  await page.screenshot({ path: file });
} finally { await browser.close(); await server.close(); }
' "model=<name>&view=sw" <scratch-dir>/look.png
```

Write the picture to your scratch directory, not the repo. The first argument is the query string;
`@` in a revision name is `%40`. Then Read the PNG.

| Parameter | What it does | Use it to check |
|---|---|---|
| `model=<name>` | the model, or `<model>%40<revision>` | which output to open (required) |
| `view=sw\|se\|ne\|nw\|top` | camera; any other value is `top` | a corner or the plan view |
| `camera=px,py,pz,tx,ty,tz` | a perspective camera at p looking at t, in scene metres (Y up, plan north is −Z) | a close-up of one window, door or joint |
| `storeys=a,b` | show only those storey ids | one storey alone; floors hiding each other |
| `style=plan\|ifc` | plan colours or the IFC's own | what other IFC viewers will show (`ifc`) |
| `diff=1` | Diff mode (revisions only) | what a revision changes, with the changes panel |
| `xray=1` | Transparency | what is behind or inside something |
| `constraints=1` | the model's constraints as red labels and spans | whether a measurement holds |
| `labels=0\|1` | room labels, on by default | clear labels out of the way |
| `ids=1` | hover shows an element's id | the id of a thing to edit; needs a pointer, see below |
| `measure=1`, `walk=1` | measurement tool, first-person mode | interactive only; the tests show how to drive them |
| `orient=project` | views on plan axes, ignoring `site.northAngle` | comparing against the plan pixel for pixel |
| `snapshot=1` | hides the UI, IFC colours, ignores `ids`, `measure` and `walk` | what `render` uses; leave it off to see the toolbar and panels |

`ids=1` labels the element under the pointer, so a still screenshot shows none. Add
`await page.mouse.move(x, y);` before `page.screenshot` (`tests/viewer-identify.test.ts` does this).

For the plan's own pixels against the 3D Top view, do not compare by eye: `tests/plan-vs-3d*.test.ts`
does it and prints the failing tiles in metres from the south-west corner.

## 4. Say what you saw

When you report that something works, say which pictures you looked at and what you checked in each.
"Checks and tests pass" and "I looked at the plan and the sw and top 3D views and the new wall is
there" are different claims. If you could not look (no Chromium, no `build`), say so.

## Notes

- Do not run `npm run view` yourself: it opens a browser window for a person. Use the recipe.
- A viewer error is an ERROR from `render` and exits 1. In your own script it is `__elmsteadError`.
- The first corner view can take a few seconds; software WebGL is slow but steady.
- Stairs are recoloured in every viewer mode, snapshots included, so their 3D colours differ from
  the IFC's. See [Rendering](../../../docs/rendering.md).
- Details of the viewer, its toolbar and its tests: [Rendering](../../../docs/rendering.md#the-viewer)
  and [Getting started](../../../docs/getting-started.md#the-3d-viewer).
