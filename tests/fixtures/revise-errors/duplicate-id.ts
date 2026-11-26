// A revision that adds a wall with an id the base already uses.
import cottage from "../../../models/examples/example-cottage/index.js";
import { addTo, mm, pt, revise, wall } from "../../../src/model/index.js";
export default revise(cottage, [addTo("storey-ground", { walls: [wall("wall-north", pt(mm(0), mm(0)), pt(mm(1000), mm(0)), { thickness: mm(100), height: mm(2400) })] })]);
