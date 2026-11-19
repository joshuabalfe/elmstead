import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BuildingModelSchema } from "../src/schema/schema.js";
import { jsonSchemaText } from "../src/schema/json-schema.js";

/** Plain JSON, as the CLI would see it after JSON.parse. */
function minimal() {
  return {
    schemaVersion: 1,
    project: { id: "proj", name: "Test" },
    site: { id: "site", name: "Site" },
    building: { id: "bldg", name: "Building" },
    storeys: [
      {
        id: "storey-ground",
        name: "Ground",
        elevation: 0,
        walls: [
          { id: "wall-a", start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thickness: 200, height: 2400, justification: "left" },
        ],
        openings: [
          { kind: "door", id: "door-a", wallId: "wall-a", offsetAlongWall: 500, width: 900, height: 2100, sillHeight: 0, swing: { hinge: "end", side: "right" } },
          { kind: "window", id: "window-a", wallId: "wall-a", offsetAlongWall: 2000, width: 1200, height: 1200, sillHeight: 900 },
        ],
        slabs: [{ id: "slab-a", outline: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }], thickness: 150, elevationOffset: 0 }],
        rooms: [{ id: "room-a", name: "Room", outline: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }] }],
      },
    ],
  };
}

const issues = (data: unknown) => {
  const r = BuildingModelSchema.safeParse(data);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("building schema", () => {
  it("accepts a valid model", () => {
    expect(issues(minimal())).toEqual([]);
  });

  it("rejects fractional millimetres", () => {
    const d = minimal();
    d.storeys[0]!.walls[0]!.thickness = 200.5;
    expect(issues(d).join()).toMatch(/storeys\.0\.walls\.0\.thickness/);
  });

  it("rejects non-positive thickness", () => {
    const d = minimal();
    d.storeys[0]!.walls[0]!.thickness = 0;
    expect(issues(d)).toHaveLength(1);
  });

  it("rejects unknown keys (catches typos)", () => {
    const d = minimal() as any;
    d.storeys[0].walls[0].thicknes = 200;
    expect(issues(d).join()).toMatch(/thicknes/);
  });

  it("rejects ids that are not kebab-case", () => {
    const d = minimal();
    d.storeys[0]!.walls[0]!.id = "Wall_A";
    expect(issues(d).join()).toMatch(/kebab-case/);
  });

  it("allows swing only on doors", () => {
    const d = minimal() as any;
    d.storeys[0].openings[1].swing = { hinge: "start", side: "left" };
    expect(issues(d).join()).toMatch(/swing/);
  });

  it("rejects polygons with fewer than 3 points", () => {
    const d = minimal();
    d.storeys[0]!.rooms[0]!.outline.pop();
    expect(issues(d).join()).toMatch(/rooms\.0\.outline/);
  });

  it("committed JSON Schema is up to date (run npm run schema)", () => {
    expect(readFileSync("schema/building.schema.json", "utf8")).toBe(jsonSchemaText());
  });
});
