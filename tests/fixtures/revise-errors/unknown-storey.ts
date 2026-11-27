// A revision that adds to a storey the base does not have.
import cottage from "../../../models/examples/example-cottage/index.js";
import { addTo, mm, pt, revise, wall } from "../../../src/model/index.js";
export default revise(cottage, [
  addTo("storey-attic", {
    walls: [wall("wall-attic", pt(mm(0), mm(0)), pt(mm(1000), mm(0)), { thickness: mm(100), height: mm(2400) })],
  }),
]);
