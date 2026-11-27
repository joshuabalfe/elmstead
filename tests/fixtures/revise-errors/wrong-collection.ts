// A revision that replaces a wall with a railing of the same id.
import cottage from "../../../models/examples/example-cottage/index.js";
import { mm, pt, railing, replace, revise } from "../../../src/backend/model/index.js";
export default revise(cottage, [
  replace(railing("wall-north", pt(mm(0), mm(0)), pt(mm(1000), mm(0)), { height: mm(900) })),
]);
