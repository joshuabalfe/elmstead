// A revision that tries to remove a storey.
import cottage from "../../../models/examples/example-cottage/index.js";
import { remove, revise } from "../../../src/backend/model/index.js";
export default revise(cottage, [remove("storey-ground")]);
