/**
 * Elmstead's floor structure: the upper storey sits on the walls below, and its floor gives every
 * room a floor while leaving the stairwell open.
 */
import { describe, expect, it } from "vitest";
import elmstead from "../models/elmstead/index.js";
import { stairwellOutline } from "../models/elmstead/first/index.js";
import { face, mm } from "../src/model/index.js";
import type { Storey } from "../src/schema/schema.js";

type Pt = { x: number; y: number };

const centroid = (poly: Pt[]): Pt => {
  let x = 0;
  let y = 0;
  let area = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const cross = poly[j]!.x * poly[i]!.y - poly[i]!.x * poly[j]!.y;
    area += cross;
    x += (poly[j]!.x + poly[i]!.x) * cross;
    y += (poly[j]!.y + poly[i]!.y) * cross;
  }
  return { x: x / (3 * area), y: y / (3 * area) };
};

const contains = (poly: Pt[], p: Pt): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

const wallTop = (s: Storey): number => s.elevation + Math.max(0, ...s.walls.map((w) => w.height));

describe("Elmstead's floor structure", () => {
  const storeys = [...elmstead.storeys].sort((a, b) => a.elevation - b.elevation);

  it("uses the owner's 2.7 m first-floor ceiling", () => {
    const first = elmstead.storeys.find((s) => s.id === "storey-first-floor");
    if (!first) throw new Error("Elmstead has no first floor");
    for (const wall of first.walls) expect(wall.height, wall.id).toBe(mm(2700));
  });

  it("puts the kitchen window above the front door", () => {
    const ground = elmstead.storeys.find((s) => s.id === "storey-ground");
    const first = elmstead.storeys.find((s) => s.id === "storey-first-floor");
    if (!ground || !first) throw new Error("Elmstead needs ground and first floors");
    const door = ground.openings.find((o) => o.id === "door-front");
    const window = first.openings.find((o) => o.id === "window-kitchen-west-first");
    if (!door || !window) throw new Error("Elmstead needs the front door and kitchen window");
    const doorWall = ground.walls.find((w) => w.id === door.wallId);
    const windowWall = first.walls.find((w) => w.id === window.wallId);
    if (!doorWall || !windowWall) throw new Error("The front door and kitchen window need their walls");
    expect(windowWall.start).toEqual(doorWall.start);
    expect(window.offsetAlongWall).toBe(door.offsetAlongWall);
    expect(window.height).toBe(mm(2100));
    expect(window.sillHeight).toBe(mm(450));
  });

  for (let i = 1; i < storeys.length; i++) {
    const lower = storeys[i - 1]!;
    const upper = storeys[i]!;
    it(`${upper.id} sits on ${lower.id}'s walls`, () => {
      expect(upper.slabs.length).toBeGreaterThan(0);
      for (const slab of upper.slabs) {
        expect(upper.elevation + slab.elevationOffset).toBe(upper.elevation);
        expect(upper.elevation + slab.elevationOffset - slab.thickness).toBe(wallTop(lower));
      }
    });
  }

  it("keeps the stair well between the stair walls", () => {
    const first = elmstead.storeys.find((s) => s.id === "storey-first-floor");
    if (!first) throw new Error("Elmstead has no first floor");
    const wall = (id: string) => {
      const w = first.walls.find((wall) => wall.id === id);
      if (!w) throw new Error(`Elmstead's first floor has no ${id}`);
      return w;
    };
    const xs = stairwellOutline.map((p) => p.x);
    const ys = stairwellOutline.map((p) => p.y);
    expect(Math.min(...xs)).toBe(face(wall("wall-ensuite-west-first"), "west"));
    expect(Math.max(...xs)).toBe(face(wall("wall-extension-east-first"), "west"));
    expect(Math.min(...ys)).toBe(face(wall("wall-ensuite-north-first"), "north"));
    expect(Math.max(...ys)).toBe(face(wall("wall-north-first"), "south"));
  });

  it("gives every first-floor room a floor and leaves the stairwell open", () => {
    const first = elmstead.storeys.find((s) => s.id === "storey-first-floor");
    if (!first) throw new Error("Elmstead has no first floor");
    for (const room of first.rooms) {
      const at = centroid(room.outline);
      expect(first.slabs.some((s) => contains(s.outline, at)), `${room.id}'s centroid is not on a slab`).toBe(true);
      expect(contains(stairwellOutline, at), `${room.id}'s centroid is inside the stairwell`).toBe(false);
    }
  });
});