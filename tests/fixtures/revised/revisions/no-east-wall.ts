// A revision that demolishes a wall a base constraint measures, without revising the constraints.
import { remove, revise } from "../../../../src/model/index.js";
import base from "../index.js";

export default revise(base, [remove("window-bathroom", "wall-east")]);
