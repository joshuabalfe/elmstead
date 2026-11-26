import { resolve } from "node:path";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { describe, expect, it, vi } from "vitest";
import { C } from "../src/render/style.js";
import { group, line, polygon, polyline, text } from "../src/render/svg.js";
import type { ResolvedConstraint } from "../src/constraints/check.js";
import { constraintLabels } from "../viewer/constraints.js";
import { disposeTree } from "../viewer/dispose.js";
import { elementLabel } from "../viewer/identify.js";
import { CLICK_SLOP_PX, SNAP_MAX_PX, axisAlignedPoint, isMeasureGesture, measurementLines, measurementSummary, measurementValues, nearestSnap } from "../viewer/measure.js";
import { M_PER_PX, dashOf, overlayGroup, placeText, toRuns, toScene } from "../viewer/overlay.js";
import { confinedPath } from "../viewer/serve.js";
import { cameraForView, cornerLabel, labelHeading, parseOrient, parseView, turnedTopFit } from "../viewer/view.js";

const dir = "/tmp/elmstead-out";

describe("confinedPath", () => {
  it("serves a file inside the directory", () => {
    expect(confinedPath(dir, "cottage.ifc")).toBe(resolve(dir, "cottage.ifc"));
    expect(confinedPath(dir, "nested/cottage.ifc")).toBe(resolve(dir, "nested/cottage.ifc"));
  });

  it("rejects traversal, sibling prefixes and absolute paths", () => {
    expect(confinedPath(dir, "../out-x/secret.ifc")).toBeUndefined();
    expect(confinedPath(dir, "%2e%2e/out-x/secret.ifc")).toBeUndefined();
    expect(confinedPath(dir, "/etc/passwd")).toBeUndefined();
  });

  it("rejects malformed percent-encoding without throwing", () => {
    expect(confinedPath(dir, "%E0%A4%A")).toBeUndefined();
  });
});

describe("parseView", () => {
  it("accepts the five camera views and falls back to top", () => {
    for (const view of ["sw", "se", "ne", "nw", "top"] as const) expect(parseView(view)).toBe(view);
    expect(parseView("sideways")).toBe("top");
    expect(parseView(null)).toBe("top");
  });
});

describe("cameraForView", () => {
  it("uses a true isometric orthographic camera for interactive corner views", () => {
    for (const view of ["sw", "se", "ne", "nw"] as const) {
      const { direction, projection } = cameraForView(view, false);
      expect(projection).toBe("Orthographic");
      expect(Math.abs(direction[0])).toBe(Math.abs(direction[1]));
      expect(Math.abs(direction[1])).toBe(Math.abs(direction[2]));
    }
    expect(cameraForView("sw", false).direction).toEqual([-1, 1, 1]);
    expect(cameraForView("ne", false).direction).toEqual([1, 1, -1]);
  });

  it("keeps the snapshot corner cameras perspective and the top view orthographic", () => {
    expect(cameraForView("sw", true)).toEqual({ direction: [-1, 0.7, 1], projection: "Perspective" });
    expect(cameraForView("top", true)).toEqual({ direction: [0, 1, 0.0001], projection: "Orthographic" });
    expect(cameraForView("top", false)).toEqual({ direction: [0, 1, 0.0001], projection: "Orthographic" });
  });
});

describe("true north views", () => {
  it("keeps the corner cameras on the plan corners whatever the north angle", () => {
    for (const view of ["sw", "se", "ne", "nw"] as const) {
      for (const snapshot of [false, true]) expect(cameraForView(view, snapshot, 153)).toEqual(cameraForView(view, snapshot));
    }
  });

  it("puts true north up the screen in the top view", () => {
    // At 153° true south is plan (sin a, −cos a): plan +x and +y, scene +X and −Z.
    const [x, y, z] = cameraForView("top", false, 153).direction;
    expect(y).toBe(1);
    expect(x).toBeCloseTo(0.0001 * Math.sin((153 * Math.PI) / 180), 12);
    expect(z).toBeCloseTo(0.0001 * Math.cos((153 * Math.PI) / 180), 12);
    expect(cameraForView("top", false, 0)).toEqual(cameraForView("top", false));
  });

  it("labels each corner with the true direction it looks from", () => {
    const labels = (angle?: number) => (["sw", "se", "ne", "nw"] as const).map((v) => cornerLabel(v, angle));
    expect(labels()).toEqual(["SW", "SE", "NE", "NW"]);
    expect(labels(153)).toEqual(["N", "W", "S", "E"]); // elmstead: plan SW stands at true 018°
    expect(labels(135)).toEqual(["N", "W", "S", "E"]);
    expect(labels(90)).toEqual(["NW", "SW", "SE", "NE"]); // true north is plan −x
  });

  it("breaks a tie between compass points clockwise", () => {
    // At 22.5° plan SW stands at 247.5°, halfway between SW and W.
    expect(cornerLabel("sw", 22.5)).toBe("W");
  });

  it("widens the Top view's framing to fit the turned plan box", () => {
    expect(turnedTopFit(5, 4, 0, 4 / 3)).toBe(1);
    expect(turnedTopFit(4, 3, 90, 4 / 3)).toBeCloseTo(4 / 3, 9); // 8 × 6 turns to 6 × 8: height-bound
    expect(turnedTopFit(5, 4, 135, 4 / 3)).toBeGreaterThan(1);
  });

  it("reads ?orient=, defaulting to true north", () => {
    expect(parseOrient("project")).toBe("project");
    expect(parseOrient("north")).toBe("north");
    expect(parseOrient("sideways")).toBe("north");
    expect(parseOrient(null)).toBe("north");
  });
});

describe("labelHeading", () => {
  /** The direction the label's text reads in plan axes, for a camera with the given screen right. */
  const reading = (right: { x: number; z: number }) => {
    const h = labelHeading(right);
    return { east: Math.cos(h), north: Math.sin(h) };
  };

  it("points the text along the camera's screen right", () => {
    // Top view and a camera from the south: screen right is east, so the plan's orientation holds.
    const top = reading({ x: 1, z: 0 });
    expect(top.east).toBeCloseTo(1);
    expect(top.north).toBeCloseTo(0);
    // From the west: screen right is south. From the north: west. From the east: north.
    const west = reading({ x: 0, z: 1 });
    expect(west.east).toBeCloseTo(0);
    expect(west.north).toBeCloseTo(-1);
    const north = reading({ x: -1, z: 0 });
    expect(north.east).toBeCloseTo(-1);
    expect(north.north).toBeCloseTo(0);
    const east = reading({ x: 0, z: -1 });
    expect(east.east).toBeCloseTo(0);
    expect(east.north).toBeCloseTo(1);
  });
});

type Pt = [number, number];
const point = ([x, y]: Pt) => ({ x, y });
const constraint = (id: string, from: Pt, to: Pt, distance: number, storey = "storey-ground", span: { from: Pt; to: Pt } = { from, to }): ResolvedConstraint => ({
  id,
  scope: "room-living",
  storey,
  from: point(from),
  to: point(to),
  span: { from: point(span.from), to: point(span.to) },
  distance,
});

describe("constraintLabels", () => {
  it("labels a storey's constraints at their midpoint with id and distance", () => {
    expect(constraintLabels([constraint("living-width", [200, 200], [3750, 3350], 3550)], "storey-ground")).toEqual([
      { at: { x: 1975, y: 1775 }, lines: ["living-width 3550"] },
    ]);
    expect(constraintLabels([constraint("first-floor", [0, 0], [1000, 1000], 1000, "storey-first")], "storey-ground")).toEqual([]);
  });

  it("uses the measured span's midpoint for an x or y constraint", () => {
    expect(
      constraintLabels([constraint("living-width", [200, 200], [3750, 3350], 3550, "storey-ground", { from: [200, 200], to: [3750, 200] })], "storey-ground"),
    ).toEqual([{ at: { x: 1975, y: 200 }, lines: ["living-width 3550"] }]);
  });

  it("stacks constraints that share a midpoint in one label", () => {
    expect(
      constraintLabels(
        [
          constraint("living-width", [200, 200], [3750, 3350], 3550),
          constraint("living-depth", [200, 200], [3750, 3350], 4200),
          constraint("front-length", [0, 0], [8000, 0], 8000),
        ],
        "storey-ground",
      ),
    ).toEqual([
      { at: { x: 1975, y: 1775 }, lines: ["living-width 3550", "living-depth 4200"] },
      { at: { x: 4000, y: 0 }, lines: ["front-length 8000"] },
    ]);
  });
});

describe("measurementValues", () => {
  it("computes straight, horizontal and vertical distances in millimetres", () => {
    expect(measurementValues({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 4 })).toEqual({ straightMm: 5000, horizontalMm: 5000, verticalMm: 0 });
    expect(measurementValues({ x: 1, y: 2, z: 3 }, { x: 1, y: 4.5, z: 3 })).toEqual({ straightMm: 2500, horizontalMm: 0, verticalMm: 2500 });
    const mixed = measurementValues({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 4 });
    expect(mixed.straightMm).toBeCloseTo(Math.sqrt(41) * 1000);
    expect(mixed.horizontalMm).toBeCloseTo(5000);
    expect(mixed.verticalMm).toBeCloseTo(4000);
  });
});

describe("measurement display", () => {
  it("rounds the scene label and the list row to whole millimetres", () => {
    const values = { straightMm: 3450.4, horizontalMm: 3400.5, verticalMm: 249.6 };
    expect(measurementLines(1, values)).toEqual(["M1 3450 mm", "horizontal 3401 mm", "vertical 250 mm"]);
    expect(measurementSummary(1, values)).toBe("M1 3450 mm · plan 3401 mm · rise 250 mm");
  });
});

describe("axisAlignedPoint", () => {
  const from = { x: 1, y: 2, z: 3 };

  it("projects onto the dominant plan axis", () => {
    expect(axisAlignedPoint(from, { x: 4, y: 2.2, z: 3.4 })).toEqual({ x: 4, y: 2, z: 3 });
    expect(axisAlignedPoint(from, { x: 1.2, y: 2.1, z: 7 })).toEqual({ x: 1, y: 2, z: 7 });
  });

  it("projects onto a vertical line when the height change dominates", () => {
    expect(axisAlignedPoint(from, { x: 1.5, y: 5, z: 3.4 })).toEqual({ x: 1, y: 5, z: 3 });
  });

  it("breaks ties in X, then Z, then Y order", () => {
    expect(axisAlignedPoint({ x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 0 })).toEqual({ x: 2, y: 0, z: 0 });
    expect(axisAlignedPoint({ x: 0, y: 0, z: 0 }, { x: 0, y: 2, z: 2 })).toEqual({ x: 0, y: 0, z: 2 });
  });
});

describe("nearestSnap", () => {
  it("chooses the nearest candidate in screen space", () => {
    const edge = { x: 10, y: 0, point: false, at: "edge" };
    const corner = { x: 12, y: 0, point: true, at: "corner" };
    expect(nearestSnap([corner, edge], { x: 0, y: 0 })?.at).toBe("edge");
  });

  it("prefers a corner only when the distances tie", () => {
    const edge = { x: -5, y: 0, point: false, at: "edge" };
    const corner = { x: 5, y: 0, point: true, at: "corner" };
    expect(nearestSnap([edge, corner], { x: 0, y: 0 })?.at).toBe("corner");
  });

  it("ignores candidates beyond the snap cut-off", () => {
    const near = { x: SNAP_MAX_PX, y: 0, point: false, at: "near" };
    const far = { x: SNAP_MAX_PX + 1, y: 0, point: false, at: "far" };
    expect(nearestSnap([near], { x: 0, y: 0 })?.at).toBe("near");
    expect(nearestSnap([far], { x: 0, y: 0 })).toBeUndefined();
    expect(nearestSnap([], { x: 0, y: 0 })).toBeUndefined();
  });
});

describe("isMeasureGesture", () => {
  it("accepts a click or tap within the slop and rejects a drag", () => {
    expect(CLICK_SLOP_PX).toBe(4);
    expect(isMeasureGesture({ x: 0, y: 0 }, { x: CLICK_SLOP_PX, y: 0 })).toBe(true);
    expect(isMeasureGesture({ x: 10, y: 10 }, { x: 8, y: 9 })).toBe(true);
    expect(isMeasureGesture({ x: 0, y: 0 }, { x: CLICK_SLOP_PX + 0.01, y: 0 })).toBe(false);
    expect(isMeasureGesture({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(false);
  });
});

describe("elementLabel", () => {
  it("takes the id from Tag and keeps a distinct Name", () => {
    expect(elementLabel({ Tag: { value: "wall-south" }, Name: { value: "South wall" } })).toEqual({ id: "wall-south", name: "South wall" });
  });

  it("shows only the id when Name falls back to it", () => {
    expect(elementLabel({ Tag: { value: "wall-south" }, Name: { value: "wall-south" } })).toEqual({ id: "wall-south", name: null });
  });

  it("takes a space's id from Name and its name from LongName", () => {
    expect(elementLabel({ Name: { value: "room-living" }, LongName: { value: "Living room" } })).toEqual({ id: "room-living", name: "Living room" });
    expect(elementLabel({ Tag: { value: "" }, Name: { value: "room-living" }, LongName: { value: "Living room" } })).toEqual({ id: "room-living", name: "Living room" });
  });

  it("returns null when the item names no model element", () => {
    expect(elementLabel({})).toBeNull();
    expect(elementLabel({ Name: { value: "" } })).toBeNull();
  });
});
describe("plan overlay geometry", () => {
  const p = (x: number, y: number) => ({ x, y });
  const bounds = { minX: 1000, minY: 2000, maxX: 9000, maxY: 5000 };
  const square = (x: number) => [p(x, 0), p(x + 10, 0), p(x + 10, 10), p(x, 10)];

  it("maps plan-SVG px to scene metres, y down to plan north along -z", () => {
    expect(toScene(p(0, 0), bounds)).toEqual({ x: 1, z: -5 });
    const s = toScene(p(10, 20), bounds); // 100 mm east and 200 mm south of the top-left corner
    expect(s.x).toBeCloseTo(1.1);
    expect(s.z).toBeCloseTo(-4.8);
  });

  it("scales stroke widths and dashes as the plan does, 1 px to 10 mm", () => {
    expect(M_PER_PX).toBeCloseTo(0.01);
    expect(dashOf({ "stroke-dasharray": "3 2" })).toEqual({ dash: expect.closeTo(0.03), gap: expect.closeTo(0.02) });
    expect(dashOf({ "stroke-dasharray": "4" })).toEqual({ dash: expect.closeTo(0.04), gap: expect.closeTo(0.04) });
    expect(dashOf({})).toBeNull();
    const [run] = toRuns([line(p(0, 0), p(1, 0), { stroke: C.opening, "stroke-width": 1.6 })]);
    expect(run).toMatchObject({ kind: "stroke", colour: C.opening, width: expect.closeTo(0.016) });
  });

  it("merges primitives that draw alike into runs, keeping the painter's order", () => {
    const runs = toRuns([
      polygon(square(0), { fill: C.wall, stroke: "none" }),
      group({ class: "wall" }, [polygon(square(20), { fill: C.wall, stroke: "none" })]),
      // A window: paper fill, then its outline, then the glass lines, then a bar in the wall colour.
      polygon(square(40), { fill: C.paper, stroke: C.opening, "stroke-width": 0.8 }),
      line(p(40, 3), p(50, 3), { stroke: C.glass, "stroke-width": 1 }),
      line(p(40, 7), p(50, 7), { stroke: C.glass, "stroke-width": 1 }),
      polygon(square(44), { fill: C.wall, stroke: "none" }),
      polyline([p(0, 0), p(5, 5), p(9, 0)], { stroke: C.opening, "stroke-width": 0.7, "stroke-dasharray": "3 2" }),
    ]);
    expect(runs.map((r) => (r.kind === "fill" ? `fill ${r.colour} ×${r.polygons.length}` : r.kind === "stroke" ? `stroke ${r.colour} ×${r.segments.length}` : "text"))).toEqual([
      `fill ${C.wall} ×2`,
      `fill ${C.paper} ×1`,
      `stroke ${C.opening} ×4`, // the outline, closed back to its start
      `stroke ${C.glass} ×2`,
      `fill ${C.wall} ×1`, // after the paper, so it isn't merged with the walls beneath it
      `stroke ${C.opening} ×2`, // a dashed polyline differs from the solid outline
    ]);
  });

  it("turns a figure as the SVG's clockwise rotate does, about its anchor", () => {
    // Unrotated, the plane's centre sits the given offset from the anchor.
    expect(placeText(p(100, 50), {}, p(0, -3.5))).toEqual({ centre: p(100, 46.5), yaw: -0 });
    // Turned 90° clockwise on screen, the text reads southwards: its "up" points east, and seen
    // from above that is a clockwise (negative) yaw about +Y.
    const { centre, yaw } = placeText(p(100, 50), { transform: "rotate(90 100 50)" }, p(0, -3.5));
    expect(centre.x).toBeCloseTo(103.5);
    expect(centre.y).toBeCloseTo(50);
    expect(yaw).toBeCloseTo(-Math.PI / 2);
    const reading = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    expect(reading.z).toBeCloseTo(1); // scene +z is plan south
  });

  it("orders a floor's runs and offsets them towards the camera, and keeps an overlay out of the depth buffer", () => {
    const nodes = [polygon(square(0), { fill: C.room, stroke: "none" }), polygon(square(0), { fill: C.paper, stroke: "none" }), line(p(0, 0), p(9, 9), { stroke: C.opening, "stroke-width": 1.6 })];
    const floor = overlayGroup(nodes, bounds, 0.02, { kind: "floor", renderOrder: -1 });
    expect(floor.children.map((c) => c.renderOrder)).toEqual([-1, -1 + 0.5 / 3, -1 + 1 / 3]);
    const materials = floor.children.map((c) => (c as THREE.Mesh).material as THREE.Material);
    expect(materials.map((m) => [m.depthWrite, m.transparent, m.polygonOffsetUnits])).toEqual([[true, false, -0], [true, false, -1], [true, false, -2]]);
    expect(floor.children[2]).toBeInstanceOf(LineSegments2);
    const mesh = floor.children[0] as THREE.Mesh;
    expect(mesh.geometry.getAttribute("position").count).toBe(6); // a square as two triangles
    expect(mesh.geometry.getAttribute("position").getY(0)).toBeCloseTo(0.02);
    const over = overlayGroup(nodes, bounds, 3, { kind: "overlay", renderOrder: 1 });
    for (const c of over.children) expect((c as THREE.Mesh).material).toMatchObject({ depthWrite: false, transparent: true, polygonOffset: false });
  });

  it("refuses plan-sheet furniture an overlay never draws", () => {
    expect(() => toRuns([text(p(0, 0), "x", {}), { tag: "rect", attrs: {} }])).toThrow(/<rect>/);
  });
});

describe("disposeTree", () => {
  it("frees every geometry, material and texture under an object except the shared ones", () => {
    const sharedMaterial = new LineMaterial();
    const sharedGeometry = new THREE.SphereGeometry();
    const ownMaterial = new LineMaterial();
    const lines = [new Line2(new LineGeometry(), sharedMaterial), new Line2(new LineGeometry(), sharedMaterial), new Line2(new LineGeometry(), ownMaterial)];
    const marker = new THREE.Mesh(sharedGeometry, new THREE.MeshBasicMaterial());
    const texture = new THREE.Texture();
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
    const root = new THREE.Group();
    const nested = new THREE.Group();
    nested.add(lines[2]!, sprite);
    root.add(lines[0]!, lines[1]!, marker, nested);
    const spies = [
      ...lines.map((l) => vi.spyOn(l.geometry, "dispose")),
      vi.spyOn(ownMaterial, "dispose"),
      vi.spyOn(marker.material, "dispose"),
      vi.spyOn(sprite.material, "dispose"),
      vi.spyOn(texture, "dispose"),
    ];
    const sharedSpies = [vi.spyOn(sharedMaterial, "dispose"), vi.spyOn(sharedGeometry, "dispose")];

    disposeTree(root, new Set([sharedMaterial, sharedGeometry]));

    for (const spy of spies) expect(spy).toHaveBeenCalledOnce();
    for (const spy of sharedSpies) expect(spy).not.toHaveBeenCalled();
  });

  it("frees a lone sprite's material and texture without a shared set", () => {
    const texture = new THREE.Texture();
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
    const material = vi.spyOn(sprite.material, "dispose");
    const map = vi.spyOn(texture, "dispose");
    disposeTree(sprite);
    expect(material).toHaveBeenCalledOnce();
    expect(map).toHaveBeenCalledOnce();
  });
});
