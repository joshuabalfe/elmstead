import { describe, expect, it } from "vitest";
import cottage from "../models/example-cottage.js";
import { corner, defineConstraints, inRoom, inStorey, jamb, m, mm, roomCorner, wallEnd } from "../src/constraints/index.js";
import { constraintsPath, loadConstraints } from "../src/constraints/load.js";
import { ConstraintError, indexModel, measureConstraint, resolvePoint, type Scope } from "../src/constraints/resolve.js";
import { loadModel } from "../src/cli/load.js";
import { checkConstraints } from "../src/constraints/check.js";
import { ConstraintsFileSchema, type Constraint, type Measure, type Point } from "../src/constraints/schema.js";
import { pt } from "../src/model/index.js";
import { BuildingModelSchema, type BuildingModel } from "../src/schema/schema.js";

/** Plain JSON, as the loader sees it after the round-trip. */
function valid() {
  return [
    {
      room: "room-living",
      constraints: [
        {
          id: "corner-to-window",
          note: "Measured on site",
          from: { corner: [{ wall: "wall-west", face: "east" }, { wall: "wall-south", face: "north" }] },
          to: { opening: "window-living", at: "start", face: "left" },
          measure: { along: "wall-south" },
          distance: 1775,
          tolerance: 5,
        },
        { id: "window-width", from: { opening: "window-living", at: "start" }, to: { opening: "window-living", at: "end" }, measure: "straight", distance: 1200 },
        { id: "room-width", from: { corner: "south-west" }, to: { room: "room-living", corner: 1 }, measure: "x", distance: 3550 },
        { id: "wall-length", from: { wall: "wall-south", end: "start" }, to: { wall: "wall-south", end: "end", face: "north" }, measure: "y", distance: 0 },
      ],
    },
    { storey: "storey-ground", constraints: [] },
  ];
}

const issues = (data: unknown) => {
  const r = ConstraintsFileSchema.safeParse(data);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("constraints schema", () => {
  it("accepts every kind of point and measure", () => {
    expect(issues(valid())).toEqual([]);
  });

  it("rejects a misspelt field", () => {
    const data = valid() as any;
    data[0].constraints[1].tolerence = 5;
    expect(issues(data)).toEqual([expect.stringMatching(/^0\.constraints\.1: .*tolerence/)]);
  });

  it("rejects a negative distance and a fractional tolerance", () => {
    const data = valid() as any;
    data[0].constraints[1].distance = -1;
    data[0].constraints[1].tolerance = 2.5;
    expect(issues(data)).toEqual([expect.stringMatching(/^0\.constraints\.1\.distance: /), expect.stringMatching(/^0\.constraints\.1\.tolerance: /)]);
  });

  it("rejects a raw coordinate as a point", () => {
    const data = valid() as any;
    data[0].constraints[1].from = { x: 0, y: 0 };
    expect(issues(data)).toEqual([expect.stringMatching(/^0\.constraints\.1\.from: /)]);
  });

  it("needs exactly one storey or room per group", () => {
    const data = valid() as any;
    data[1].room = "room-living";
    delete data[0].room;
    expect(issues(data)).toEqual(["0: a group names exactly one storey or one room", "1: a group names exactly one storey or one room"]);
  });
});

describe("constraint helpers", () => {
  it("build the same value from a model object or its id", () => {
    const west = cottage.storeys[0]!.walls.find((w) => w.id === "wall-west")!;
    const living = cottage.storeys[0]!.rooms.find((r) => r.id === "room-living")!;
    expect(corner({ wall: west, face: "east" }, { wall: "wall-south", face: "north" })).toEqual(corner({ wall: "wall-west", face: "east" }, { wall: "wall-south", face: "north" }));
    expect(wallEnd(west, "start", "east")).toEqual(wallEnd("wall-west", "start", "east"));
    expect(roomCorner(living, "south-west")).toEqual(roomCorner("room-living", "south-west"));
    expect(inRoom(living, [])).toEqual(inRoom("room-living", []));
  });

  it("leave optional fields out rather than writing undefined", () => {
    expect(wallEnd("wall-west", "end")).toEqual({ wall: "wall-west", end: "end" });
    expect(jamb("window-living", "centre")).toEqual({ opening: "window-living", at: "centre" });
    expect(roomCorner(2)).toEqual({ corner: 2 });
  });

  it("produce values that pass the schema", () => {
    const groups = defineConstraints([
      inRoom("room-living", [
        { id: "a", from: corner({ wall: "wall-west", face: "east" }, { wall: "wall-south", face: "north" }), to: jamb("window-living", "start", "left"), measure: { along: "wall-south" }, distance: mm(1000) },
        { id: "b", from: roomCorner("south-west"), to: wallEnd("wall-south", "end"), measure: "x", distance: m(2), tolerance: mm(0) },
      ]),
      inStorey("storey-ground", []),
    ]);
    expect(issues(JSON.parse(JSON.stringify(groups)))).toEqual([]);
  });
});

describe("loadConstraints", () => {
  it("finds constraints.ts in a folder model, given the folder or its index.ts", () => {
    expect(constraintsPath("models/elmstead")).toBe("models/elmstead/constraints.ts");
    expect(constraintsPath("models/elmstead/")).toBe("models/elmstead/constraints.ts");
    expect(constraintsPath("models/elmstead/index.ts")).toBe("models/elmstead/constraints.ts");
  });

  it("finds <name>.constraints.ts beside a single-file model", () => {
    expect(constraintsPath("models/example-cottage.ts")).toBe("models/example-cottage.constraints.ts");
  });

  it("loads a folder model's constraints", async () => {
    const r = await loadConstraints("tests/fixtures/constraints-folder");
    expect(r.ok && r.value?.path).toBe("tests/fixtures/constraints-folder/constraints.ts");
    expect(r.ok && r.value?.groups[0]?.constraints.map((c) => c.id)).toEqual(["window-living-width"]);
  });

  it("gives no constraints, and no issues, when there is no file", async () => {
    expect(await loadConstraints("tests/fixtures/bad-component.ts")).toEqual({ ok: true, value: undefined });
  });

  it("reports a file that throws against the file, with its stack", async () => {
    const r = await loadConstraints("tests/fixtures/constraints-throws.ts");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.path).toBe("tests/fixtures/constraints-throws.constraints.ts");
      expect(r.issues).toEqual([{ level: "ERROR", id: r.path, message: expect.stringMatching(/^constraints threw while evaluating: Error: constraints file broke\n\s+at /) }]);
    }
  });

  it("reports a misspelt field against the constraint", async () => {
    const r = await loadConstraints("tests/fixtures/constraints-misspelt.ts");
    expect(!r.ok && r.issues).toEqual([{ level: "ERROR", id: "window-living-width", message: expect.stringMatching(/^schema: 0\.constraints\.0: .*tolerence/) }]);
  });

  it("reports a duplicate constraint id", async () => {
    const r = await loadConstraints("tests/fixtures/constraints-duplicate.ts");
    expect(!r.ok && r.issues).toEqual([{ level: "ERROR", id: "window-living-width", message: "constraint id is used twice" }]);
  });
});

/** The cottage, plus a diagonal wall, a room with a 45° corner and a first floor. */
function testModel(): BuildingModel {
  const m = BuildingModelSchema.parse(JSON.parse(JSON.stringify(cottage)));
  const ground = m.storeys[0]!;
  ground.walls.push({ id: "wall-diagonal", start: pt(mm(1000), mm(1000)), end: pt(mm(3000), mm(3000)), thickness: mm(200), height: mm(2400), justification: "centre" });
  ground.rooms.push({ id: "room-angled", name: "Angled", outline: [pt(mm(0), mm(0)), pt(mm(2000), mm(0)), pt(mm(2000), mm(1000)), pt(mm(1000), mm(2000)), pt(mm(0), mm(2000))] });
  m.storeys.push({
    id: "storey-first",
    name: "First floor",
    elevation: mm(2700),
    walls: [{ id: "wall-first", start: pt(mm(0), mm(0)), end: pt(mm(4000), mm(0)), thickness: mm(200), height: mm(2400), justification: "left" }],
    openings: [{ kind: "window", id: "window-first", wallId: "wall-first", offsetAlongWall: mm(1000), width: mm(1200), height: mm(1200), sillHeight: mm(900) }],
    slabs: [],
    rooms: [],
  });
  return m;
}

const ix = indexModel(testModel());
const ground: Scope = { kind: "storey", id: "storey-ground", storey: "storey-ground" };
const living: Scope = { kind: "room", id: "room-living", storey: "storey-ground" };
const at = (p: Point, scope = ground) => resolvePoint(ix, p, scope).at;
const error = (f: () => unknown): string => {
  try {
    f();
  } catch (e) {
    if (e instanceof ConstraintError) return e.message;
    throw e;
  }
  throw new Error("expected a ConstraintError");
};

describe("wall faces", () => {
  it("resolve compass faces on walls running east, west, north and south", () => {
    expect(at(wallEnd("wall-south", "start", "north"))).toEqual({ x: 0, y: 200 }); // runs east
    expect(at(wallEnd("wall-south", "start", "south"))).toEqual({ x: 0, y: 0 });
    expect(at(wallEnd("wall-north", "start", "south"))).toEqual({ x: 8000, y: 5800 }); // runs west
    expect(at(wallEnd("wall-east", "start", "west"))).toEqual({ x: 7800, y: 200 }); // runs north
    expect(at(wallEnd("wall-west", "start", "east"))).toEqual({ x: 200, y: 5800 }); // runs south
  });

  it("resolve left and right on any wall", () => {
    expect(at(wallEnd("wall-west", "start", "left"))).toEqual(at(wallEnd("wall-west", "start", "east")));
    expect(at(wallEnd("wall-diagonal", "start", "left"))).toEqual({ x: 1000 - 100 / Math.SQRT2, y: 1000 + 100 / Math.SQRT2 });
  });

  it("reject a compass side the wall does not have", () => {
    expect(error(() => at(wallEnd("wall-south", "start", "east")))).toBe("wall-south runs east–west, so it has no east face");
  });

  it("reject compass faces on a diagonal wall", () => {
    expect(error(() => at(wallEnd("wall-diagonal", "start", "north")))).toBe("wall-diagonal is not axis-aligned, so it has no north face: name its face left or right");
  });
});

describe("corner, wall end and opening points", () => {
  it("find where two wall faces cross", () => {
    expect(at(corner({ wall: "wall-west", face: "east" }, { wall: "wall-south", face: "north" }))).toEqual({ x: 200, y: 200 });
  });

  it("put a wall end on the wall line without a face", () => {
    expect(at(wallEnd("wall-south", "start"))).toEqual({ x: 0, y: 0 });
    expect(at(wallEnd("wall-south", "end"))).toEqual({ x: 8000, y: 0 });
  });

  it("put an opening's jambs and centre on the wall line or a face", () => {
    // window-living: on wall-south, 1375 mm from its start, 1200 mm wide
    expect(at(jamb("window-living", "start"))).toEqual({ x: 1375, y: 0 });
    expect(at(jamb("window-living", "end", "north"))).toEqual({ x: 2575, y: 200 });
    expect(at(jamb("window-living", "centre", "left"))).toEqual({ x: 1975, y: 200 });
  });

  it("measure an opening's width from jamb to jamb along its wall", () => {
    const width = { id: "w", from: jamb("window-living", "start"), to: jamb("window-living", "end", "north"), measure: { along: "wall-south" }, distance: mm(0) };
    expect(measureConstraint(ix, width, ground)).toBe(1200);
  });

  it("report unknown ids, the wrong kind of element and parallel faces", () => {
    expect(error(() => at(jamb("window-gone", "start")))).toBe("window-gone is not in the model");
    expect(error(() => at(jamb("wall-south", "start")))).toBe("wall-south is a wall, not an opening");
    expect(error(() => at(wallEnd("door-front", "start")))).toBe("door-front is a door, not a wall");
    expect(error(() => at(corner({ wall: "wall-south", face: "north" }, { wall: "wall-north", face: "south" })))).toBe("the faces of wall-south and wall-north are parallel, so they do not meet");
  });
});

describe("room corner points", () => {
  it("find a rectangular room's compass corners and numbered vertices", () => {
    expect(at(roomCorner("room-living", "south-west"))).toEqual({ x: 200, y: 200 });
    expect(at(roomCorner("room-living", "north-east"))).toEqual({ x: 3750, y: 3350 });
    expect(at(roomCorner("room-living", 2))).toEqual({ x: 3750, y: 3350 });
  });

  it("report a vertex number past the end", () => {
    expect(error(() => at(roomCorner("room-living", 4)))).toBe("room-living has 4 vertices, numbered 0 to 3");
  });

  it("report two vertices equally far in the compass direction", () => {
    expect(error(() => at(roomCorner("room-angled", "north-east")))).toBe("room-angled has 2 vertices equally far to the north-east: name a vertex number instead");
  });

  it("take the group's room when the room is left out", () => {
    expect(at(roomCorner("south-west"), living)).toEqual({ x: 200, y: 200 });
    expect(error(() => at(roomCorner("south-west"), ground))).toBe("a room corner outside a room group needs a room");
  });
});

describe("measures", () => {
  const between = (from: Point, to: Point, measure: Measure, scope = ground) => measureConstraint(ix, { id: "c", from, to, measure, distance: mm(0) }, scope);
  const sw = corner({ wall: "wall-west", face: "east" }, { wall: "wall-south", face: "north" });

  it("measure straight, in x and in y, unsigned", () => {
    const ne = roomCorner("room-living", "north-east"); // (3750, 3350)
    expect(between(sw, ne, "straight")).toBe(Math.round(Math.hypot(3550, 3150)));
    expect(between(ne, sw, "x")).toBe(3550);
    expect(between(ne, sw, "y")).toBe(3150);
  });

  it("measure along a diagonal wall without its thickness", () => {
    const from = wallEnd("wall-diagonal", "start", "left");
    const to = wallEnd("wall-diagonal", "end", "right");
    expect(between(from, to, { along: "wall-diagonal" })).toBe(2828);
    expect(between(from, to, "straight")).toBe(2835); // √(2828.4² + 200²)
  });

  it("report a missing or non-wall wall to measure along", () => {
    expect(error(() => between(sw, jamb("window-living", "start"), { along: "wall-x" }))).toBe("wall-x is not in the model");
    expect(error(() => between(sw, jamb("window-living", "start"), { along: "room-living" }))).toBe("room-living is a room, not a wall");
  });

  it("report points on two storeys", () => {
    expect(error(() => between(wallEnd("wall-south", "start"), jamb("window-first", "start"), "straight"))).toBe("its points are on different storeys: storey-ground and storey-first");
  });

  it("report an element away from the room group's storey", () => {
    const first: Scope = { kind: "storey", id: "storey-first", storey: "storey-first" };
    expect(error(() => between(wallEnd("wall-first", "start"), jamb("window-first", "start"), "straight", living))).toBe("wall-first is not on the room's storey, storey-ground");
    expect(between(wallEnd("wall-first", "start"), jamb("window-first", "start"), "x", first)).toBe(1000);
  });
});

describe("checkConstraints", () => {
  const sw = corner({ wall: "wall-west", face: "east" }, { wall: "wall-south", face: "north" }); // (200, 200)
  const window = jamb("window-living", "start"); // 1175 mm east of sw, along wall-south
  const along = { along: "wall-south" } as const;
  const check = (...constraints: Constraint[]) => checkConstraints(testModel(), [inRoom("room-living", constraints)]);

  it("counts a constraint that is met", () => {
    expect(check({ id: "c", from: sw, to: window, measure: along, distance: mm(1175) })).toEqual({ issues: [], met: 1, total: 1 });
  });

  it("allows 10 mm by default, or the constraint's own tolerance", () => {
    expect(check({ id: "c", from: sw, to: window, measure: along, distance: mm(1167) }).met).toBe(1);
    expect(check({ id: "c", from: sw, to: window, measure: along, distance: mm(1167), tolerance: mm(5) })).toEqual({
      issues: [{ level: "ERROR", id: "c", message: "is 1175 mm, should be 1167 ±5 mm (room-living)" }],
      met: 0,
      total: 1,
    });
  });

  it("rounds a fractional measurement before comparing", () => {
    // sw to the living room's north-east corner is √(3550² + 3150²) ≈ 4746.05 mm: 10.05 mm over 4736.
    const ne = roomCorner("north-east");
    expect(check({ id: "c", from: sw, to: ne, measure: "straight", distance: mm(4736) }).met).toBe(1);
    expect(check({ id: "c", from: sw, to: ne, measure: "straight", distance: mm(4735) }).issues).toEqual([{ level: "ERROR", id: "c", message: "is 4746 mm, should be 4735 ±10 mm (room-living)" }]);
  });

  it("reports a constraint that cannot be measured and still checks the rest", () => {
    const r = check({ id: "gone", from: sw, to: jamb("window-gone", "start"), measure: along, distance: mm(0) }, { id: "ok", from: sw, to: window, measure: along, distance: mm(1175) });
    expect(r).toEqual({ issues: [{ level: "ERROR", id: "gone", message: "window-gone is not in the model (room-living)" }], met: 1, total: 2 });
  });

  it("reports a group whose room or storey is not in the model", () => {
    const groups = [inRoom("room-renamed", [{ id: "c", from: sw, to: window, measure: along, distance: mm(1175) }]), inStorey("wall-south", [])];
    expect(checkConstraints(testModel(), groups)).toEqual({
      issues: [
        { level: "ERROR", id: "room-renamed", message: "constraint group's room: room-renamed is not in the model" },
        { level: "ERROR", id: "wall-south", message: "constraint group's storey: wall-south is a wall, not a storey" },
      ],
      met: 0,
      total: 1,
    });
  });
});

describe("the models' constraints", () => {
  for (const [path, count] of [["models/example-cottage.ts", 6], ["models/elmstead", 15]] as const) {
    it(`${path} meets all ${count} of its constraints`, async () => {
      const loaded = await loadModel(path);
      const constraints = await loadConstraints(path);
      expect(loaded.ok && constraints.ok && constraints.value).toBeTruthy();
      if (!loaded.ok || !constraints.ok || !constraints.value) return;
      expect(checkConstraints(loaded.value.model, constraints.value.groups)).toEqual({ issues: [], met: count, total: count });
    });
  }
});
