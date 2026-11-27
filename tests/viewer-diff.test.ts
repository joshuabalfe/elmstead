import { describe, expect, it } from "vitest";
import cottage from "../models/examples/example-cottage/index.js";
import rearExtension from "../models/examples/example-cottage/revisions/rear-extension.js";
import { diffModels } from "../src/shared/diff/index.js";
import { renderFloor, renderWallTops } from "../src/shared/render/plan.js";
import type { Node } from "../src/shared/render/svg.js";
import { BuildingModelSchema, type BuildingModel, type Point, type Storey } from "../src/shared/schema/schema.js";
import {
  CHANGED_OUTLINE,
  DIFF_COLOURS,
  diffFloor,
  doorSwings,
  floorChange,
  floorOutlines,
  floorPieces,
  recolourPlan,
  removedPlan,
  statusById,
} from "../src/frontend/lib/diff.js";

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

/** A polygon's area in m², by the shoelace formula. */
const area = (pts: Point[]): number =>
  Math.abs(
    pts.reduce((a, p, i) => {
      const q = pts[(i + 1) % pts.length]!;
      return a + p.x * q.y - q.x * p.y;
    }, 0),
  ) / 2e6;
const rect = (x0: number, y0: number, x1: number, y1: number): Point[] =>
  [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ] as Point[];
const withRooms = (s: Storey, outlines: Point[][]): Storey => ({
  ...s,
  slabs: [],
  rooms: outlines.map((outline, i) => ({ id: `room-${i}`, name: "Room", outline })),
});

describe("floorChange", () => {
  const [was, now] = [base.storeys[0]!, revision.storeys[0]!];

  it("finds the cottage's new floor in the lean-to and the knocked-out wall, and none in the old kitchen", () => {
    const change = floorChange(was, now);
    expect(change.removed).toEqual([]);
    const areas = change.added.map(area).sort((a, b) => b - a);
    expect(areas[0]).toBeCloseTo((3600 * 2400) / 1e6, 1); // the lean-to's slab
    expect(areas.slice(1).every((a) => a < 0.6)).toBe(true); // at most the wall's strip
  });

  it("finds a room's growth, its loss, and nothing when floor only changes room", () => {
    const room = rect(0, 0, 4000, 3000);
    expect(floorChange(withRooms(was, [room]), withRooms(was, [rect(0, 0, 5000, 3000)])).added.map(area)).toEqual([3]);
    expect(floorChange(withRooms(was, [room]), withRooms(was, [rect(0, 0, 3000, 3000)])).removed.map(area)).toEqual([
      3,
    ]);
    const moved = floorChange(
      withRooms(was, [rect(0, 0, 2000, 3000), rect(2000, 0, 4000, 3000)]),
      withRooms(was, [rect(0, 0, 3000, 3000), rect(3000, 0, 4000, 3000)]),
    );
    expect(moved).toEqual({ added: [], removed: [] });
  });
});

describe("diffFloor, floorOutlines and doorSwings", () => {
  const floor = renderFloor(revision.storeys[0]!, revision.components);

  it("tints each added and removed floor piece", () => {
    const pieces = floorPieces({ added: [rect(0, 0, 1000, 1000)], removed: [rect(2000, 0, 3000, 1000)] });
    const d = diffFloor(renderFloor({ ...revision.storeys[0]!, slabs: [], rooms: pieces, openings: [] }))!;
    expect(paintOf(d.nodes, "floor-added-0").fills).toEqual([DIFF_COLOURS.added.floor]);
    expect(paintOf(d.nodes, "floor-removed-0").fills).toEqual([DIFF_COLOURS.removed.floor]);
  });

  it("is null when there is no floor change", () => {
    expect(diffFloor(renderFloor(base.storeys[0]!, base.components))).toBeNull();
  });

  it("outlines the changed slabs and rooms in bright yellow and the added ones in green, unfilled", () => {
    const o = floorOutlines(floor, status)!;
    expect(o.nodes.map((n) => n.attrs["data-id"])).toEqual([
      "slab-lean-to",
      "room-living",
      "room-bedroom",
      "room-bathroom",
      "room-lean-to",
    ]);
    expect(paintOf(o.nodes, "room-living")).toMatchObject({ fills: [], strokes: [CHANGED_OUTLINE] });
    expect(paintOf(o.nodes, "room-lean-to")).toMatchObject({ fills: [], strokes: [DIFF_COLOURS.added.accent] });
  });

  it("picks the door swings out of the floor drawing", () => {
    expect(doorSwings(floor).nodes.map((n) => n.attrs["data-id"])).toEqual([
      "door-front",
      "door-back",
      "door-living",
      "door-kitchen",
      "door-bedroom",
      "door-bathroom",
    ]);
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
    const { styleOfColour } = await import("../src/frontend/scene/style-of.js");
    for (const colours of Object.values(DIFF_COLOURS)) {
      for (const hex of Object.values(colours)) expect(styleOfColour(new THREE.Color(hex)), hex).toBeUndefined();
    }
  });

  it("still recognises the IFC's own colours", async () => {
    const THREE = await import("three");
    const { styleOfColour } = await import("../src/frontend/scene/style-of.js");
    const { STYLES } = await import("../src/shared/ifc/styles.js");
    const wall = STYLES.wall.rgb;
    expect(styleOfColour(new THREE.Color().setRGB(wall[0], wall[1], wall[2], THREE.SRGBColorSpace))).toBe("wall");
  });
});
