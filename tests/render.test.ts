import { describe, expect, it } from "vitest";
import cottage from "../models/example-cottage/index.js";
import elmstead from "../models/elmstead/index.js";
import { deg, door, m, mm, pt, railing, wall } from "../src/model/index.js";
import { doorGeometry, renderFloor, renderPlan, renderPlanAnnotations, renderWallTops } from "../src/render/plan.js";
import { svgToPng } from "../src/render/png.js";
import { C } from "../src/render/style.js";
import { BuildingModelSchema } from "../src/schema/schema.js";
import { splayedCottage } from "./support/reveal.js";

const model = BuildingModelSchema.parse(JSON.parse(JSON.stringify(cottage)));
const storey = model.storeys[0]!;
const svg = renderPlan(model, storey, { ids: false });

const ids = (cls: string) => [...svg.matchAll(new RegExp(`class="${cls}" data-id="([^"]+)"`, "g"))].map((x) => x[1]);

describe("plan renderer", () => {
  it("is deterministic", () => {
    expect(renderPlan(model, storey, { ids: false })).toBe(svg);
    expect(renderPlan(model, storey, { ids: true })).toBe(renderPlan(model, storey, { ids: true }));
  });

  it("fills a ground slab with the ground colour in the plan and the floor overlay", () => {
    const ground = BuildingModelSchema.parse(JSON.parse(JSON.stringify(cottage)));
    ground.storeys[0]!.slabs[0]!.material = "ground";
    const groundStorey = ground.storeys[0]!;
    expect(renderPlan(ground, groundStorey, { ids: false })).toContain(`fill="${C.ground}"`);
    expect(renderFloor(groundStorey).svg).toContain(`fill="${C.ground}"`);
    expect(svg).not.toContain(`fill="${C.ground}"`);
    expect(renderFloor(storey).svg).not.toContain(`fill="${C.ground}"`);
  });

  it("matches the committed reference drawing (update with: npx vitest run -u)", async () => {
    await expect(svg).toMatchFileSnapshot("__snapshots__/example-cottage.storey-ground.plan.svg");
  });

  it("splits each wall around its openings", () => {
    const pieces = ids("wall");
    const per = (id: string) => pieces.filter((p) => p === id).length;
    expect(per("wall-south")).toBe(4); // two windows and the front door
    expect(per("wall-north")).toBe(3); // back door and kitchen window
    expect(per("wall-east")).toBe(2);
    expect(per("wall-west")).toBe(1);
    expect(per("wall-hall-west")).toBe(3);
    expect(pieces).toHaveLength(18);
  });

  it("dimensions every room wall to wall, east–west then north–south", () => {
    for (const r of storey.rooms) {
      const g = svg.match(new RegExp(`<g class="room-dimensions" data-id="${r.id}">([\\s\\S]*?)</g>`))?.[1] ?? "";
      const figures = [...g.matchAll(/>(\d+)<\/text>/g)].map((x) => Number(x[1]));
      const pts = r.dimensionOutline ?? r.outline;
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      expect(figures, r.id).toEqual([Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]);
    }
  });

  it("measures a room's dimension outline when it has one", () => {
    const outlined = structuredClone(model);
    const living = outlined.storeys[0]!.rooms.find((r) => r.id === "room-living")!;
    living.dimensionOutline = [pt(mm(900), mm(900)), pt(mm(3000), mm(900)), pt(mm(3000), mm(2500)), pt(mm(900), mm(2500))];
    const out = renderPlan(outlined, outlined.storeys[0]!, { ids: false });
    const g = out.match(/<g class="room-dimensions" data-id="room-living">([\s\S]*?)<\/g>/)?.[1] ?? "";
    const figures = [...g.matchAll(/>(\d+)<\/text>/g)].map((x) => Number(x[1]));
    expect(figures).toEqual([2100, 1600]);
  });

  it("turns the north arrow to site.northAngle and keeps the N upright beyond its tip", () => {
    const turned = { ...model, site: { ...model.site, northAngle: 135 } } as typeof model;
    const out = renderPlan(turned, storey, { ids: false });
    expect(out).toContain("rotate(-135)");
    // 135° counter-clockwise from up is down-left on screen, so the N sits left of and below the centre.
    const [, x, y] = out.match(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>N<\/text>/)!.map(Number);
    const at = { x: Number(out.match(/width="(\d+)"/)![1]) - 35, y: 40 };
    expect(x).toBeLessThan(at.x);
    expect(y).toBeGreaterThan(at.y);
  });

  it("draws one symbol per door and window, and every room", () => {
    expect(ids("door").sort()).toEqual(storey.openings.filter((o) => o.kind === "door").map((o) => o.id).sort());
    expect(ids("window").sort()).toEqual(storey.openings.filter((o) => o.kind === "window").map((o) => o.id).sort());
    expect(ids("room").sort()).toEqual(storey.rooms.map((r) => r.id).sort());
  });

  it("labels rooms with name and area", () => {
    expect(svg).toContain(">Living room<");
    expect(svg).toContain(">11.2 m²<");
    expect(svg).toContain(">6.2 m²<"); // hall 1.10 × 5.60
  });

  it("only draws element ids when asked", () => {
    expect(svg).not.toContain(">wall-south<");
    expect(renderPlan(model, storey, { ids: true })).toContain(">wall-south<");
  });

  it("leaves a wall uncut by an opening above the cut plane, and draws it dashed", () => {
    const withFanlight = structuredClone(model);
    const s = withFanlight.storeys[0]!;
    const front = s.openings.find((o) => o.id === "door-front")!;
    s.openings.push({ kind: "window", id: "window-fanlight", wallId: front.wallId, offsetAlongWall: front.offsetAlongWall, width: front.width, height: mm(300), sillHeight: mm(2200) });
    const out = renderPlan(withFanlight, s, { ids: false });
    const pieces = [...out.matchAll(/class="wall" data-id="wall-south"/g)].length;
    expect(pieces).toBe(4); // unchanged: the fanlight does not split the wall again
    expect(out).toContain('class="window" data-id="window-fanlight" data-cut="false"');
  });

  describe("a splayed reveal", () => {
    /** Each polygon's points for one element, as [x, y] pairs in px. */
    const polygons = (out: string, cls: string, id: string) =>
      [...out.matchAll(new RegExp(`<polygon points="([^"]+)"[^>]*class="${cls}" data-id="${id}"`, "g"))].map((x) => x[1]!.split(" ").map((p) => p.split(",").map(Number)));
    const windowOutline = (out: string, id: string) => {
      const group = out.match(new RegExp(`<g class="window" data-id="${id}"[^>]*>([\\s\\S]*?)</g>`))![1]!;
      return group.match(/<polygon points="([^"]+)"/)![1]!.split(" ").map((p) => p.split(",").map(Number));
    };

    it("ends the wall either side at an angle from the middle to the splayed face", () => {
      const m = splayedCottage();
      const out = renderPlan(m, m.storeys[0]!, { ids: false });
      // South wall, west to east: corner to living window, living window to front door, then square on.
      const south = polygons(out, "wall", "wall-south");
      expect(south.map((p) => p.length)).toEqual([5, 5, 4, 4]);
      // At 1 px = 10 mm the 100 mm splay is 10 px at the inside (left, upper) face and none at the outside.
      const [, , bend, inside] = south[0]!;
      expect(south[0]!.slice(0, 2)).toEqual([[60, 670], [197.5, 670]]);
      expect([bend, inside]).toEqual([[197.5, 660], [187.5, 650]]);
      expect(windowOutline(out, "window-living")).toHaveLength(6);
    });

    it("bends both ends of a stretch between two splayed openings", () => {
      const m = splayedCottage();
      const s = m.storeys[0]!;
      const bedroom = s.openings.find((o) => o.id === "window-bedroom")!;
      if (bedroom.kind === "window") bedroom.reveal = { face: "left", angle: deg(45) };
      s.openings = s.openings.filter((o) => o.id !== "door-front"); // so the two windows are neighbours
      const out = renderPlan(m, s, { ids: false });
      expect(polygons(out, "wall", "wall-south").map((p) => p.length)).toEqual([5, 6, 5]);
    });

    it("leaves out a stretch a splay runs into, rather than drawing it twisted", () => {
      // The living window's inside splay reaches 2675; the bedroom window, moved to 2625, starts
      // 50 mm after it on the outside face. The checks report the overlap; the plan stays sane.
      const m = splayedCottage();
      m.storeys[0]!.openings.find((o) => o.id === "window-bedroom")!.offsetAlongWall = mm(2625);
      const out = renderPlan(m, m.storeys[0]!, { ids: false });
      expect(polygons(out, "wall", "wall-south").map((p) => p.length)).toEqual([5, 4, 4]);
    });

    it("dashes the splayed outline of a window the cut misses", () => {
      const m = splayedCottage();
      const living = m.storeys[0]!.openings.find((o) => o.id === "window-living")!;
      living.sillHeight = mm(1500);
      const out = renderPlan(m, m.storeys[0]!, { ids: false });
      const group = out.match(/<g class="window" data-id="window-living" data-cut="false">([\s\S]*?)<\/g>/)![1]!;
      expect(group.match(/<polygon points="([^"]+)"/)![1]!.split(" ")).toHaveLength(6);
    });
  });

  it("writes a PNG at 2× the SVG size", () => {
    const png = svgToPng(svg);
    const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    const [sw, sh] = [Number(svg.match(/width="(\d+)"/)![1]), Number(svg.match(/height="(\d+)"/)![1])];
    expect([w, h]).toEqual([sw * 2, sh * 2]);
  });
});

describe("railings on the plan", () => {
  const withRailing = (r: ReturnType<typeof railing>) => {
    const m = structuredClone(model);
    m.storeys[0]!.railings = [r];
    return m;
  };
  const width = (svg: string) => Number(svg.match(/width="(\d+)"/)![1]);

  it("draws a group with its id, rail line, post ticks and optional id label", () => {
    const m = withRailing(railing("railing-a", pt(mm(500), mm(500)), pt(mm(3500), mm(500)), { height: mm(900) }));
    const s = m.storeys[0]!;
    const plan = renderPlan(m, s, { ids: false });
    expect(plan).toContain('class="railing" data-id="railing-a"');
    const body = plan.match(/<g class="railing" data-id="railing-a">([\s\S]*?)<\/g>/)![1]!;
    expect(body).toContain(`stroke="${C.railing}"`);
    expect([...body.matchAll(/<line /g)]).toHaveLength(21); // the rail plus one tick at each of 20 posts
    expect(plan).not.toContain(">railing-a<");
    expect(renderPlan(m, s, { ids: true })).toContain(">railing-a<");
  });

  it("includes an outlying railing in the plan extent but not in the shared overlay bounds", () => {
    const outlying = railing("railing-out", pt(m(20), m(20)), pt(m(22), m(20)), { height: mm(900) });
    const withRail = withRailing(outlying);
    const plain = structuredClone(withRail);
    plain.storeys[0]!.railings = [];
    expect(width(renderPlan(withRail, withRail.storeys[0]!, { ids: false }))).toBeGreaterThan(width(renderPlan(plain, plain.storeys[0]!, { ids: false })));

    for (const render of [renderFloor, renderWallTops, renderPlanAnnotations]) {
      expect(render(withRail.storeys[0]!).bounds).toEqual(render(plain.storeys[0]!).bounds);
      expect(render(withRail.storeys[0]!).svg).not.toContain("railing");
    }
  });

  it("draws railings before the stair layer", () => {
    const street = elmstead.storeys.find((s) => s.id === "storey-street")!;
    const plan = renderPlan(elmstead, street, { ids: false });
    const railingAt = plan.indexOf('class="railing"');
    expect(railingAt).toBeGreaterThan(-1);
    expect(plan.indexOf('class="stair"')).toBeGreaterThan(railingAt);
  });
});

describe("door swing geometry", () => {
  const size = { width: mm(900), height: m(2.1) };
  const eastward = wall("wall-e", pt(mm(0), mm(0)), pt(m(4), mm(0)), { thickness: mm(200), height: m(2.4), justification: "left" });
  const northward = wall("wall-n", pt(mm(0), mm(0)), pt(mm(0), m(4)), { thickness: mm(100), height: m(2.4) });

  it("left/right are relative to the wall direction, hinge on the face it opens towards", () => {
    const l = doorGeometry(eastward, door("d", eastward, m(1), size, { hinge: "start", side: "left" }));
    expect(l.hinge).toEqual({ x: 1000, y: 200 }); // left face of a left-justified eastward wall
    expect(l.open).toEqual({ x: 1000, y: 1100 }); // opens north
    expect(l.closed).toEqual({ x: 1900, y: 200 });

    const r = doorGeometry(eastward, door("d", eastward, m(1), size, { hinge: "end", side: "right" }));
    expect(r.hinge).toEqual({ x: 1900, y: 0 });
    expect(r.open).toEqual({ x: 1900, y: -900 }); // opens south

    const n = doorGeometry(northward, door("d", northward, m(1), size, { hinge: "start", side: "right" }));
    expect(n.hinge).toEqual({ x: 50, y: 1000 }); // right of a northward wall is east
    expect(n.open).toEqual({ x: 950, y: 1000 });
  });

  it("defaults to hinge at start, opening to the left", () => {
    const d = doorGeometry(eastward, door("d", eastward, m(1), size));
    expect(d.hinge).toEqual({ x: 1000, y: 200 });
    expect(d.open.y).toBe(1100);
  });
});
