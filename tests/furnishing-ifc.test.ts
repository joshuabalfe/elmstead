/** Furnishings in the IFC: classes, types, bodies, placement and the round-trip volumes. */
import * as WebIFC from "web-ifc";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import cottage from "../models/examples/example-cottage/index.js";
import furnished from "../models/examples/example-cottage/revisions/furnished.js";
import { ifcApi } from "../src/backend/ifc/api.js";
import { ifcGuid } from "../src/backend/ifc/guid.js";
import { ifcGeometry, roundTripChecks } from "../src/backend/ifc/roundtrip.js";
import { writeIfc } from "../src/backend/ifc/writer.js";
import { deg, furnishing, mm, pt } from "../src/backend/model/index.js";
import { FURNISHING_IFC, furnishingGeometry } from "../src/shared/geometry/furnishing.js";
import { STYLES } from "../src/shared/ifc/styles.js";
import { BuildingModelSchema, type BuildingModel, type Furnishing } from "../src/shared/schema/schema.js";

const parse = (source: unknown): BuildingModel => BuildingModelSchema.parse(JSON.parse(JSON.stringify(source)));
const write = (m: BuildingModel) => writeIfc(m, { fileName: "furnished.ifc" });
const withFurnishings = (...list: Furnishing[]): BuildingModel => {
  const m = parse(cottage);
  m.storeys[0]!.furnishings = list;
  return m;
};

const at = (x: number, y: number) => pt(mm(x), mm(y));

/** An opened IFC: `lines` reads every entity of a class, and a handle resolves a reference. */
async function open(ifc: Uint8Array) {
  const api = await ifcApi();
  const id = api.OpenModel(ifc);
  const line = (handle: { value: number }) => api.GetLine(id, handle.value);
  const lines = (type: number) => {
    const found = api.GetLineIDsWithType(id, type);
    return Array.from({ length: found.size() }, (_, i) => api.GetLine(id, found.get(i)));
  };
  const text = (v: { value?: string } | string | null | undefined) => (typeof v === "string" ? v : (v?.value ?? null));
  return { api, id, line, lines, text, close: () => api.CloseModel(id) };
}
type Opened = Awaited<ReturnType<typeof open>>;

const num = (v: unknown) => (typeof v === "number" ? v : (v as { value: number }).value);

describe("furnishings in IFC", () => {
  const model = parse(furnished);
  const all = model.storeys[0]!.furnishings!;
  let ifc: Uint8Array;
  let o: Opened;
  beforeAll(async () => {
    ifc = await write(model);
    o = await open(ifc);
  });
  afterAll(() => o.close());

  const byTag = (type: number) => new Map(o.lines(type).map((l) => [o.text(l.Tag) as string, l]));

  it("writes furniture as IfcFurniture and fittings as IfcSanitaryTerminal, tagged and named by id", () => {
    const furniture = byTag(WebIFC.IFCFURNITURE);
    const sanitary = byTag(WebIFC.IFCSANITARYTERMINAL);
    expect([...furniture.keys()].sort()).toEqual(
      all
        .filter((f) => FURNISHING_IFC[f.kind].class === "furniture")
        .map((f) => f.id)
        .sort(),
    );
    expect([...sanitary.keys()].sort()).toEqual(
      all
        .filter((f) => FURNISHING_IFC[f.kind].class === "sanitary")
        .map((f) => f.id)
        .sort(),
    );
    expect(furniture.size + sanitary.size).toBe(12);
    for (const f of all) {
      const line = (furniture.get(f.id) ?? sanitary.get(f.id))!;
      expect(o.text(line.Name), f.id).toBe(f.name ?? f.id);
      expect(o.text(line.GlobalId), f.id).toBe(ifcGuid(f.id));
    }
  });

  it("uses a name when the furnishing has one", async () => {
    const named = await open(
      await write(withFurnishings({ ...furnishing("sofa-a", "sofa", at(2000, 1000)), name: "Settee" })),
    );
    try {
      expect(named.text(named.lines(WebIFC.IFCFURNITURE)[0]!.Name)).toBe("Settee");
    } finally {
      named.close();
    }
  });

  it("contains every furnishing in its storey", () => {
    const rel = o
      .lines(WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE)
      .find((r) => o.text(o.line(r.RelatingStructure).GlobalId) === ifcGuid("storey-ground"))!;
    const contained = new Set(rel.RelatedElements.map((e: { value: number }) => o.text(o.line(e).Tag)));
    for (const f of all) expect(contained.has(f.id), f.id).toBe(true);
  });

  it("gives each element and its type the kind's predefined type", () => {
    const elements = new Map([...byTag(WebIFC.IFCFURNITURE), ...byTag(WebIFC.IFCSANITARYTERMINAL)]);
    const related = new Map<string, { type: string | null; predefined: string | null }>();
    for (const rel of o.lines(WebIFC.IFCRELDEFINESBYTYPE)) {
      const type = o.line(rel.RelatingType);
      for (const e of rel.RelatedObjects) {
        const tag = o.text(o.line(e).Tag) as string;
        related.set(tag, { type: o.text(type.ElementType), predefined: o.text(type.PredefinedType) });
      }
    }
    for (const f of all) {
      const { predefined } = FURNISHING_IFC[f.kind];
      expect(o.text(elements.get(f.id)!.PredefinedType), `${f.id} element`).toBe(predefined);
      expect(related.get(f.id), `${f.id} type`).toEqual({ type: f.kind, predefined });
    }
  });

  it("maps a toilet to a toilet pan and a file cabinet to FILECABINET", () => {
    const predefined = (type: number, tag: string) => o.text(byTag(type).get(tag)!.PredefinedType);
    expect(predefined(WebIFC.IFCSANITARYTERMINAL, "toilet-bathroom")).toBe("TOILETPAN");
    expect(predefined(WebIFC.IFCSANITARYTERMINAL, "wash-basin-bathroom")).toBe("WASHHANDBASIN");
    expect(predefined(WebIFC.IFCFURNITURE, "file-cabinet-living")).toBe("FILECABINET");
  });

  it("gives the body one extruded solid per part, and a footprint curve", () => {
    const elements = new Map([...byTag(WebIFC.IFCFURNITURE), ...byTag(WebIFC.IFCSANITARYTERMINAL)]);
    for (const f of all) {
      const shape = o.line(elements.get(f.id)!.Representation);
      const reps = shape.Representations.map((r: { value: number }) => o.line(r));
      const body = reps.find(
        (r: { RepresentationIdentifier: unknown }) => o.text(r.RepresentationIdentifier as never) === "Body",
      );
      const footprint = reps.find(
        (r: { RepresentationIdentifier: unknown }) => o.text(r.RepresentationIdentifier as never) === "FootPrint",
      );
      expect(body.Items, f.id).toHaveLength(furnishingGeometry(f).parts.length);
      expect(o.text(body.RepresentationType)).toBe("SweptSolid");
      expect(o.text(footprint.RepresentationType)).toBe("Curve2D");
      expect(footprint.Items).toHaveLength(1);
    }
  });

  it("makes a chair six solids and a table five, not one block", () => {
    const solids = (tag: string) => {
      const line = byTag(WebIFC.IFCFURNITURE).get(tag)!;
      const body = o
        .line(line.Representation)
        .Representations.map((r: { value: number }) => o.line(r))
        .find((r: { RepresentationIdentifier: unknown }) => o.text(r.RepresentationIdentifier as never) === "Body");
      return body.Items.length;
    };
    expect(solids("chair-kitchen")).toBe(6);
    expect(solids("table-kitchen")).toBe(5);
  });

  it("outlines the footprint with the overall width and depth", () => {
    const table = byTag(WebIFC.IFCFURNITURE).get("table-kitchen")!;
    const footprint = o
      .line(table.Representation)
      .Representations.map((r: { value: number }) => o.line(r))
      .find((r: { RepresentationIdentifier: unknown }) => o.text(r.RepresentationIdentifier as never) === "FootPrint");
    const polyline = o.line(footprint.Items[0]);
    const points = polyline.Points.map((p: { value: number }) => o.line(p).Coordinates.map(num));
    expect(points).toHaveLength(5);
    expect(points[0]).toEqual(points[4]);
    const xs = points.map((p: number[]) => p[0]!);
    const ys = points.map((p: number[]) => p[1]!);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(1500);
    expect(Math.max(...ys) - Math.min(...ys)).toBe(800);
  });

  it("colours furniture and sanitary parts differently", () => {
    const text = new TextDecoder().decode(ifc);
    const styled = (name: string) => {
      const style = new RegExp(`#(\\d+)=IFCSURFACESTYLE\\('${name}'`).exec(text)![1];
      return (text.match(new RegExp(`IFCSTYLEDITEM\\(#\\d+,\\(#${style}\\)`, "g")) ?? []).length;
    };
    const parts = (cls: string) =>
      all
        .filter((f) => FURNISHING_IFC[f.kind].class === cls)
        .reduce((n, f) => n + furnishingGeometry(f).parts.length, 0);
    expect(styled("furniture")).toBe(parts("furniture"));
    expect(styled("sanitary")).toBe(parts("sanitary"));
    expect(STYLES.furniture.rgb).not.toEqual(STYLES.sanitary.rgb);
  });
});

describe("furnishing types", () => {
  const chairs = [1, 2, 3].map((i) => furnishing(`chair-${i}`, "chair", at(1000 + i * 600, 1500)));
  const model = withFurnishings(...chairs, furnishing("bed-a", "bed", at(6000, 1500)));
  let o: Opened;
  beforeAll(async () => {
    o = await open(await write(model));
  });
  afterAll(() => o.close());

  const typeOf = (rel: { RelatingType: { value: number } }) => o.line(rel.RelatingType);

  it("writes one type per kind used and relates every instance of the kind to it", () => {
    const furnitureTypes = o.lines(WebIFC.IFCFURNITURETYPE);
    expect(furnitureTypes.map((t) => o.text(t.PredefinedType)).sort()).toEqual(["BED", "CHAIR"]);
    const rels = o
      .lines(WebIFC.IFCRELDEFINESBYTYPE)
      .filter((r) => o.text(typeOf(r).PredefinedType) === "CHAIR" || o.text(typeOf(r).PredefinedType) === "BED");
    const related = Object.fromEntries(
      rels.map((r) => [
        o.text(typeOf(r).PredefinedType),
        r.RelatedObjects.map((e: { value: number }) => o.text(o.line(e).Tag)),
      ]),
    );
    expect(related).toEqual({ CHAIR: ["chair-1", "chair-2", "chair-3"], BED: ["bed-a"] });
  });

  it("declares the types in the project", () => {
    const declared = o
      .lines(WebIFC.IFCRELDECLARES)
      .flatMap((r) => r.RelatedDefinitions.map((d: { value: number }) => o.text(o.line(d).GlobalId)));
    expect(declared).toContain(ifcGuid("furnishing-type#chair"));
    expect(declared).toContain(ifcGuid("furnishing-type#bed"));
  });

  it("writes no type for a kind no furnishing uses", () => {
    expect(o.lines(WebIFC.IFCFURNITURETYPE)).toHaveLength(2);
    expect(o.lines(WebIFC.IFCSANITARYTERMINALTYPE)).toHaveLength(0);
  });

  it("derives type GlobalIds from the kind, the same in every build", async () => {
    const [a, b] = await Promise.all([write(model), write(model)]);
    expect(a).toEqual(b);
    const types = o.lines(WebIFC.IFCFURNITURETYPE);
    expect(types.map((t) => o.text(t.GlobalId)).sort()).toEqual(
      [ifcGuid("furnishing-type#bed"), ifcGuid("furnishing-type#chair")].sort(),
    );
  });

  it("never writes USERDEFINED or NOTDEFINED as a predefined type", async () => {
    const all = parse(furnished);
    const full = await open(await write(all));
    try {
      const predefined = [
        ...full.lines(WebIFC.IFCFURNITURE),
        ...full.lines(WebIFC.IFCSANITARYTERMINAL),
        ...full.lines(WebIFC.IFCFURNITURETYPE),
        ...full.lines(WebIFC.IFCSANITARYTERMINALTYPE),
      ].map((l) => full.text(l.PredefinedType));
      expect(predefined).toHaveLength(24);
      expect(predefined.filter((p) => p === "USERDEFINED" || p === "NOTDEFINED")).toEqual([]);
    } finally {
      full.close();
    }
  });
});

describe("a model with no furnishings", () => {
  it("writes no furnishing entities", async () => {
    const text = new TextDecoder().decode(await write(parse(cottage)));
    for (const entity of ["IFCFURNITURE", "IFCSANITARYTERMINAL", "furnishing-type", "'furniture'", "'sanitary'"])
      expect(text, entity).not.toContain(entity);
  });
});

describe("placement", () => {
  /** The cottage's ground storey raised to 3100 mm, with the furnishings on it. */
  const raised = (...list: Furnishing[]) => {
    const m = withFurnishings(...list);
    m.storeys[0]!.elevation = mm(3100);
    return m;
  };

  /** A placement's location and X direction in the plan, and its z in the project, through its parents. */
  const placementOf = (o: Opened, tag: string, type = WebIFC.IFCFURNITURE) => {
    const element = o.lines(type).find((l) => o.text(l.Tag) === tag)!;
    let placement = o.line(element.ObjectPlacement);
    let z = 0;
    const own = o.line(placement.RelativePlacement);
    const direction = own.RefDirection ? o.line(own.RefDirection).DirectionRatios.map(num) : [1, 0, 0];
    const location = o.line(own.Location).Coordinates.map(num);
    for (;;) {
      z += num(o.line(o.line(placement.RelativePlacement).Location).Coordinates[2]);
      if (!placement.PlacementRelTo) break;
      placement = o.line(placement.PlacementRelTo);
    }
    return { location, direction, z };
  };

  it("turns the local X axis along plan +y for a quarter turn and stands the base on the storey", async () => {
    const o = await open(await write(raised(furnishing("table-a", "table", at(3000, 2000), { rotation: deg(90) }))));
    try {
      const p = placementOf(o, "table-a");
      expect(p.location.slice(0, 2)).toEqual([3000, 2000]);
      expect(p.direction[0]).toBeCloseTo(0, 9);
      expect(p.direction[1]).toBeCloseTo(1, 9);
      expect(p.z).toBe(3100);
    } finally {
      o.close();
    }
  });

  it("leaves an unrotated furnishing's X axis along plan +x", async () => {
    const o = await open(await write(raised(furnishing("table-a", "table", at(3000, 2000)))));
    try {
      expect(placementOf(o, "table-a").direction).toEqual([1, 0, 0]);
    } finally {
      o.close();
    }
  });

  it("lifts a raised shelf by its elevation offset", async () => {
    const o = await open(
      await write(
        raised(furnishing("shelf-a", "shelf", at(3000, 2000), { elevationOffset: mm(900), height: mm(600) })),
      ),
    );
    try {
      expect(placementOf(o, "shelf-a").z).toBe(4000);
    } finally {
      o.close();
    }
  });
});

describe("furnishing volumes in the round-trip", () => {
  const check = async (m: BuildingModel) => roundTripChecks(m, await write(m));

  it("accepts every furnishing of the furnished cottage", async () => {
    expect(await check(parse(furnished))).toEqual([]);
  });

  it("accepts a chair unrotated and at 37 degrees, with the same volume", async () => {
    for (const rotation of [0, 37]) {
      const m = withFurnishings(furnishing("chair-a", "chair", at(2000, 1500), { rotation: deg(rotation) }));
      expect(await check(m), `rotation ${rotation}`).toEqual([]);
      const geometry = await ifcGeometry(await write(m));
      expect(geometry.get("chair-a")!.volume).toBeCloseTo(furnishingGeometry(m.storeys[0]!.furnishings![0]!).volume, 0);
    }
  });

  it("accepts a hollow bath, whose volume is less than its bounding box", async () => {
    const m = withFurnishings(furnishing("bath-a", "bath", at(2000, 1500)));
    expect(await check(m)).toEqual([]);
    const geometry = await ifcGeometry(await write(m));
    expect(geometry.get("bath-a")!.volume).toBeLessThan(1700 * 700 * 550 * 0.5);
  });

  it("accepts an overridden bed width and a raised furnishing", async () => {
    const m = withFurnishings(
      furnishing("bed-a", "bed", at(2000, 1500), { width: mm(900) }),
      furnishing("shelf-a", "shelf", at(3500, 1500), { elevationOffset: mm(900) }),
    );
    expect(await check(m)).toEqual([]);
  });

  it("reports a furnishing whose IFC body no longer matches the model", async () => {
    const m = withFurnishings(furnishing("bed-a", "bed", at(2000, 1500)));
    const ifc = await write(m);
    const wider = structuredClone(m);
    wider.storeys[0]!.furnishings![0]!.width = mm(1800);
    const issues = await roundTripChecks(wider, ifc);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "ERROR", id: "bed-a" });
    expect(issues[0]!.message).toMatch(/furnishing volume/);
  });

  it("counts a furnishing among the expected volumes, once", async () => {
    const m = parse(furnished);
    const { expectedVolumes } = await import("../src/backend/ifc/roundtrip.js");
    const mine = expectedVolumes(m).filter((e) => e.what === "furnishing");
    expect(mine.map((e) => e.id).sort()).toEqual(m.storeys[0]!.furnishings!.map((f) => f.id).sort());
    for (const e of mine) expect(e.volume, e.id).toBeGreaterThan(0);
  });
});
