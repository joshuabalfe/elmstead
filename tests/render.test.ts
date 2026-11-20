import { describe, expect, it } from "vitest";
import cottage from "../models/example-cottage.js";
import { door, m, mm, pt, wall } from "../src/model/index.js";
import { doorGeometry, renderPlan } from "../src/render/plan.js";
import { svgToPng } from "../src/render/png.js";
import { BuildingModelSchema } from "../src/schema/schema.js";

const model = BuildingModelSchema.parse(JSON.parse(JSON.stringify(cottage)));
const storey = model.storeys[0]!;
const svg = renderPlan(model, storey, { ids: false });

const ids = (cls: string) => [...svg.matchAll(new RegExp(`class="${cls}" data-id="([^"]+)"`, "g"))].map((x) => x[1]);

describe("plan renderer", () => {
  it("is deterministic", () => {
    expect(renderPlan(model, storey, { ids: false })).toBe(svg);
    expect(renderPlan(model, storey, { ids: true })).toBe(renderPlan(model, storey, { ids: true }));
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
      const xs = r.outline.map((p) => p.x);
      const ys = r.outline.map((p) => p.y);
      expect(figures, r.id).toEqual([Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]);
    }
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

  it("writes a PNG at 2× the SVG size", () => {
    const png = svgToPng(svg);
    const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    const [sw, sh] = [Number(svg.match(/width="(\d+)"/)![1]), Number(svg.match(/height="(\d+)"/)![1])];
    expect([w, h]).toEqual([sw * 2, sh * 2]);
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
