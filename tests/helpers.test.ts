import { describe, expect, it } from "vitest";
import { centredOn, deg, door, doorComponent, face, faceCrossing, m, mm, pt, rectWalls, wall, window, windowComponent } from "../src/model/index.js";

const opts = { thickness: mm(200), height: m(2.4) };

describe("model helpers", () => {
  const w = rectWalls("wall", pt(mm(0), mm(0)), m(8), m(6), opts);

  it("rectWalls butts east/west walls between full-length south/north walls", () => {
    expect(w.south.start).toEqual({ x: 0, y: 0 });
    expect(w.south.end).toEqual({ x: 8000, y: 0 });
    expect(w.east.start).toEqual({ x: 8000, y: 200 });
    expect(w.east.end).toEqual({ x: 8000, y: 5800 });
    expect(w.north.start).toEqual({ x: 8000, y: 6000 });
    expect(w.west.end).toEqual({ x: 0, y: 200 });
  });

  it("wall() passes through a flat height or a pitched profile, never both", () => {
    const flat = wall("wall-flat", pt(mm(0), mm(0)), pt(mm(4000), mm(0)), { thickness: mm(200), height: mm(2400) });
    expect(flat).toMatchObject({ height: 2400, justification: "centre" });
    expect(flat).not.toHaveProperty("profile");
    const profile = [{ along: mm(0), up: mm(0) }, { along: mm(2000), up: mm(3200) }, { along: mm(4000), up: mm(0) }];
    const pitched = wall("wall-gable", pt(mm(0), mm(0)), pt(mm(4000), mm(0)), { thickness: mm(200), profile });
    expect(pitched.profile).toEqual(profile);
    expect(pitched).not.toHaveProperty("height");
  });

  it("face() returns inner and outer faces for walls in any direction", () => {
    expect(face(w.south, "south")).toBe(0);
    expect(face(w.south, "north")).toBe(200);
    expect(face(w.north, "south")).toBe(5800); // north wall runs westwards
    expect(face(w.east, "west")).toBe(7800);
    expect(face(w.west, "east")).toBe(200); // west wall runs southwards
    const c = wall("wall-c", pt(m(3), mm(0)), pt(m(3), m(2)), { thickness: mm(100), height: m(2.4) });
    expect([face(c, "west"), face(c, "east")]).toEqual([2950, 3050]);
    const r = wall("wall-r", pt(mm(0), mm(0)), pt(m(1), mm(0)), { ...opts, justification: "right" });
    expect([face(r, "south"), face(r, "north")]).toEqual([-200, 0]);
  });

  it("face() rejects a side the wall does not have", () => {
    expect(() => face(w.south, "east")).toThrow(/no|not axis-aligned/);
  });

  it("faceCrossing() finds where a diagonal wall's faces cross a vertical or horizontal line", () => {
    // 45° wall, 200 thick, centred on the line from (0, 0) to (1000, 1000): its faces are the lines
    // y = x ± 141.4 (200 / 2 · √2), left being the upper one.
    const d = wall("wall-d", pt(mm(0), mm(0)), pt(mm(1000), mm(1000)), opts);
    expect(faceCrossing(d, "left", "x", mm(500))).toEqual(pt(mm(500), mm(641)));
    expect(faceCrossing(d, "right", "x", mm(500))).toEqual(pt(mm(500), mm(359)));
    expect(faceCrossing(d, "left", "y", mm(0))).toEqual(pt(mm(-141), mm(0)));
    // An axis-aligned wall agrees with face().
    expect(faceCrossing(w.south, "left", "x", mm(3000)).y).toBe(face(w.south, "north"));
    expect(() => faceCrossing(w.south, "left", "y", mm(100))).toThrow(/runs along/);
  });

  it("door() and window() take a component and a size, and link to the component", () => {
    const internal = doorComponent("door-type-internal", "Internal door");
    const sash = windowComponent("window-type-sash", "Sash");
    const swing = { hinge: "end", side: "right" } as const;
    expect(door("door-a", w.south, mm(100), internal, { width: mm(800), height: m(2.1) }, swing)).toEqual({
      kind: "door", id: "door-a", wallId: "wall-south", offsetAlongWall: 100, componentId: "door-type-internal", width: 800, height: 2100, sillHeight: 0, swing,
    });
    // One design, two sizes.
    expect(window("window-a", w.south, mm(100), sash, { width: mm(1050), height: m(1.2), sillHeight: mm(900) })).toMatchObject({ componentId: "window-type-sash", width: 1050 });
    expect(window("window-b", w.south, mm(100), sash, { width: mm(950), height: m(1.2), sillHeight: mm(900) })).toMatchObject({ componentId: "window-type-sash", width: 950 });
    // A bare size still works, with no component.
    expect(window("window-b", w.south, mm(100), { width: m(1), height: m(1), sillHeight: mm(900) })).not.toHaveProperty("componentId");
    expect(door("door-b", w.south, mm(100), { width: mm(800), height: m(2.1) })).not.toHaveProperty("componentId");
  });

  it("window() takes an optional reveal last, with or without a component", () => {
    const sash = windowComponent("window-type-sash", "Sash");
    const size = { width: mm(1050), height: m(1.2), sillHeight: mm(900) };
    const reveal = { face: "left", angle: deg(45) } as const;
    expect(window("window-a", w.south, mm(100), sash, size, reveal)).toMatchObject({ componentId: "window-type-sash", reveal: { face: "left", angle: 45 } });
    expect(window("window-b", w.south, mm(100), size, reveal)).toMatchObject({ width: 1050, reveal });
    expect(window("window-c", w.south, mm(100), sash, size)).not.toHaveProperty("reveal");
    expect(window("window-d", w.south, mm(100), size)).not.toHaveProperty("reveal");
  });

  it("centredOn() handles walls running in either direction", () => {
    expect(centredOn(w.south, m(2), m(1.2))).toBe(1400);
    expect(centredOn(w.north, m(2), m(1.2))).toBe(5400); // starts at x=8000
    expect(() => centredOn(w.south, m(9), m(1))).toThrow(/beyond/);
  });
});
