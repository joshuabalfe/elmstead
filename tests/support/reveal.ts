import cottage from "../../models/examples/example-cottage/index.js";
import { deg } from "../../src/model/index.js";
import { BuildingModelSchema, type BuildingModel } from "../../src/schema/schema.js";

/**
 * The example cottage with its living-room window splayed 45° on the inside (the south wall's
 * left face). The wall is 200 mm, so each jamb moves 100 mm at that face: 1200 mm becomes 1400.
 */
export function splayedCottage(): BuildingModel {
  const m = BuildingModelSchema.parse(JSON.parse(JSON.stringify(cottage)));
  const w = m.storeys[0]!.openings.find((o) => o.id === "window-living")!;
  if (w.kind !== "window") throw new Error("window-living is not a window");
  w.reveal = { face: "left", angle: deg(45) };
  return m;
}
