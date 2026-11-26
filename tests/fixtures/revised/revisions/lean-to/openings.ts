import { doorway, mm } from "../../../../../src/model/index.js";
import base from "../../index.js";

const north = base.storeys[0]!.walls.find((w) => w.id === "wall-north")!;
// wall-north runs east to west from x = 8000, so 2200 along it is x = 5800 .. 4900, clear of door-back.
export const openings = [doorway("doorway-lean-to", north, mm(2200), { width: mm(900), height: mm(2100) })];
