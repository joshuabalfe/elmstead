import { describe, expect, it } from "vitest";
import cottage from "../models/examples/example-cottage/index.js";
import rearExtension from "../models/examples/example-cottage/revisions/rear-extension.js";
import { diffModels } from "../src/diff/index.js";
import { renderFloor, renderWallTops } from "../src/render/plan.js";
import type { Node } from "../src/render/svg.js";
import { BuildingModelSchema, type BuildingModel } from "../src/schema/schema.js";
import { DIFF_COLOURS, diffFloor, doorSwings, recolourPlan, removedPlan, statusById } from "../viewer/diff.js";

const model = (source: unknown): BuildingModel => BuildingModelSchema.parse(JSON.parse(JSON.stringify(source)));
const base = model(cottage);
const revision = model(rearExtension);
const status = statusById(diffModels(base, revision));

/** Every node with its element id, flattened, and the fills and strokes drawn under it. */
function paintOf(nodes: readonly Node[], id: string): { fills: string[]; strokes: string[]; dashed: boolean } {
  const out = { fills: [] as string[], strokes: [] as string[], dashed: false };
  const walk = (n: Node, inside: boolean) => {
    const here = inside || n.attrs["data-id"] === id;
    if (here && n.tag !== "g") {
      if (n.attrs.fill !== undefined && n.attrs.fill !== "none") out.fills.push(String(n.attrs.fill));
      if (n.attrs.stroke !== undefined && n.attrs.stroke !== "none") out.strokes.push(String(n.attrs.stroke));
      if (n.attrs["stroke-dasharray"] !== undefined) out.dashed = true;
    }
    if (n.tag === "g") for (const k of n.children) walk(k, here);
  };
  for (const n of nodes) walk(n, false);
  return out;
}

describe("statusById", () => {
  it("maps every listed element to its status, and leaves out hidden categories", () => {
    expect(status.get("wall-lean-to-north")).toBe("added");
    expect(status.get("window-living")).toBe("changed");
    expect(status.get("wall-living-kitchen")).toBe("removed");
    expect(status.has("wall-south")).toBe(false);
    const noRemoved = statusById(diffModels(base, revision), { added: true, changed: true, removed: false });
    expect(noRemoved.has("wall-living-kitchen")).toBe(false);
    expect(noRemoved.get("window-living")).toBe("changed");
  });
});

describe("recolourPlan", () => {
  const tops = recolourPlan(renderWallTops(revision.storeys[0]!, revision.components), status);

  it("draws an added wall in the accent and a changed window's symbol in the fill with accent strokes", () => {
    expect(paintOf(tops.nodes, "wall-lean-to-north").fills).toEqual([DIFF_COLOURS.added.accent]);
    const win = paintOf(tops.nodes, "window-living");
    expect(win.fills).toEqual([DIFF_COLOURS.changed.fill]);
    expect(new Set(win.strokes)).toEqual(new Set([DIFF_COLOURS.changed.accent]));
  });

  it("leaves unchanged elements in their normal colours", () => {
    const plain = renderWallTops(revision.storeys[0]!, revision.components);
    expect(paintOf(tops.nodes, "wall-south")).toEqual(paintOf(plain.nodes, "wall-south"));
  });
});

describe("diffFloor and doorSwings", () => {
  const floor = renderFloor(revision.storeys[0]!, revision.components);

  it("keeps just the added and changed slab and room fills, in their fill colour", () => {
    const d = diffFloor(floor, status)!;
    expect(d.nodes.map((n) => n.attrs["data-id"])).toEqual(["slab-lean-to", "room-living", "room-lean-to"]);
    expect(paintOf(d.nodes, "room-living").fills).toEqual([DIFF_COLOURS.changed.fill]);
  });

  it("is null for a storey with no floor changes", () => {
    expect(diffFloor(renderFloor(base.storeys[0]!, base.components), new Map())).toBeNull();
  });

  it("picks the door swings out of the floor drawing", () => {
    expect(doorSwings(floor).nodes.map((n) => n.attrs["data-id"])).toEqual(["door-front", "door-back", "door-living", "door-kitchen", "door-bedroom", "door-bathroom"]);
  });
});

describe("removedPlan", () => {
  it("draws the base storey's removed wall and window, dashed in red, and nothing else", () => {
    const r = removedPlan(renderWallTops(base.storeys[0]!, base.components), status)!;
    expect(r.nodes.map((n) => n.attrs["data-id"]).sort()).toEqual(["wall-living-kitchen", "window-kitchen"]);
    const wall = paintOf(r.nodes, "wall-living-kitchen");
    expect(wall.fills).toEqual([DIFF_COLOURS.removed.fill]);
    expect(wall.strokes).toEqual([DIFF_COLOURS.removed.accent]);
    expect(wall.dashed).toBe(true);
  });

  it("is null when nothing was removed", () => {
    expect(removedPlan(renderWallTops(base.storeys[0]!, base.components), new Map())).toBeNull();
  });
});

describe("diff colours and plan style", () => {
  it("are recognised as no IFC presentation colour, so plan style never patches a diff material", async () => {
    const THREE = await import("three");
    const { styleOfColour } = await import("../viewer/style-of.js");
    for (const { fill, accent } of Object.values(DIFF_COLOURS)) {
      expect(styleOfColour(new THREE.Color(fill)), fill).toBeUndefined();
      expect(styleOfColour(new THREE.Color(accent)), accent).toBeUndefined();
    }
  });

  it("still recognises the IFC's own colours", async () => {
    const THREE = await import("three");
    const { styleOfColour } = await import("../viewer/style-of.js");
    const { STYLES } = await import("../src/ifc/styles.js");
    const wall = STYLES.wall.rgb;
    expect(styleOfColour(new THREE.Color().setRGB(wall[0], wall[1], wall[2], THREE.SRGBColorSpace))).toBe("wall");
  });
});
