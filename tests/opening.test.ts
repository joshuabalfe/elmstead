import { describe, expect, it } from "vitest";
import { isSplayed, jambEdges, openingExtent, openingOutline, openingProfile, revealSplay } from "../src/geometry/opening.js";
import { wallSegmentFootprint } from "../src/geometry/wall.js";
import { deg, m, mm, pt, wall, window, type Reveal } from "../src/model/index.js";

const size = { width: mm(1200), height: m(1), sillHeight: mm(900) };
/** 4 m walls, 400 mm thick, running east, one for each justification. */
const walls = (["centre", "left", "right"] as const).map((justification) => wall(`wall-${justification}`, pt(mm(0), mm(0)), pt(m(4), mm(0)), { thickness: mm(400), height: m(2.4), justification }));
const reveal = (face: Reveal["face"], angle = 45): Reveal => ({ face, angle: deg(angle) });
const round = (ps: { x: number; y: number }[]) => ps.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));

describe("opening outline", () => {
  const centre = walls[0]!;

  it("splays 1200 mm to 1600 mm across a 400 mm wall at 45°, from the middle to the face", () => {
    const o = window("window-a", centre, mm(1000), size, reveal("left"));
    expect(revealSplay(centre, o)).toBeCloseTo(200);
    expect(openingExtent(centre, o, "right")).toEqual([1000, 2200]);
    expect(openingExtent(centre, o, "left").map(Math.round)).toEqual([800, 2400]);
    expect(round(openingProfile(centre, o))).toEqual([
      { x: 1000, y: -200 }, { x: 2200, y: -200 }, // square from the right face...
      { x: 2200, y: 0 }, // ...to the middle
      { x: 2400, y: 200 }, { x: 800, y: 200 }, // splayed at the left face
      { x: 1000, y: 0 },
    ]);
  });

  it("splays towards the right face too", () => {
    const o = window("window-a", centre, mm(1000), size, reveal("right"));
    expect(round(openingProfile(centre, o))).toEqual([
      { x: 800, y: -200 }, { x: 2400, y: -200 },
      { x: 2200, y: 0 }, { x: 2200, y: 200 }, { x: 1000, y: 200 }, { x: 1000, y: 0 },
    ]);
  });

  it("puts the splay on the named face whatever the wall's justification", () => {
    for (const w of walls) {
      for (const face of ["left", "right"] as const) {
        const o = window("window-a", w, mm(1000), size, reveal(face));
        const ps = openingProfile(w, o);
        const ys = ps.map((p) => p.y);
        const faceY = face === "left" ? Math.max(...ys) : Math.min(...ys);
        const xs = ps.filter((p) => Math.abs(p.y - faceY) < 1e-9).map((p) => Math.round(p.x));
        expect(xs.sort((a, b) => a - b), `${w.justification} ${face}`).toEqual([800, 2400]);
      }
    }
  });

  it("carries the face lines out by the clearance and the splayed jambs along their own lines", () => {
    const o = window("window-a", centre, mm(1000), size, reveal("left"));
    expect(round(openingProfile(centre, o, 10))).toEqual([
      { x: 1000, y: -210 }, { x: 2200, y: -210 }, { x: 2200, y: 0 }, { x: 2410, y: 210 }, { x: 790, y: 210 }, { x: 1000, y: 0 },
    ]);
    const square = window("window-b", centre, mm(1000), size);
    expect(openingProfile(centre, square, 10)).toEqual([{ x: 1000, y: -210 }, { x: 2200, y: -210 }, { x: 2200, y: 210 }, { x: 1000, y: 210 }]);
  });

  it("is wallSegmentFootprint for a square opening, in the same order", () => {
    const diagonal = wall("wall-d", pt(mm(0), mm(0)), pt(m(3), m(3)), { thickness: mm(300), height: m(2.4), justification: "left" });
    for (const w of [...walls, diagonal]) {
      const o = window("window-a", w, mm(500), size);
      expect(openingOutline(w, o)).toEqual(wallSegmentFootprint(w, 500, 1700));
    }
  });

  it("splits the profile into its jambs, each from the right face to the left", () => {
    const square = jambEdges(openingProfile(centre, window("window-a", centre, mm(1000), size)));
    expect(square).toEqual({ near: [{ x: 1000, y: -200 }, { x: 1000, y: 200 }], far: [{ x: 2200, y: -200 }, { x: 2200, y: 200 }] });
    const splayed = jambEdges(openingProfile(centre, window("window-a", centre, mm(1000), size, reveal("left"))));
    expect({ near: round(splayed.near), far: round(splayed.far) }).toEqual({
      near: [{ x: 1000, y: -200 }, { x: 1000, y: 0 }, { x: 800, y: 200 }],
      far: [{ x: 2200, y: -200 }, { x: 2200, y: 0 }, { x: 2400, y: 200 }],
    });
  });

  it("knows a splayed window from a square one", () => {
    expect(isSplayed(window("window-a", centre, mm(1000), size, reveal("left")))).toBe(true);
    expect(isSplayed(window("window-a", centre, mm(1000), size))).toBe(false);
  });

  it("has a shallower splay at a smaller angle", () => {
    const o = window("window-a", centre, mm(1000), size, reveal("left", 30));
    expect(revealSplay(centre, o)).toBeCloseTo(200 * Math.tan(Math.PI / 6));
  });
});
