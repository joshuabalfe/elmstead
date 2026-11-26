// A revision whose edit names a wall the base does not have.
import cottage from "../../../models/examples/example-cottage/index.js";
import { remove, revise } from "../../../src/model/index.js";
export default revise(cottage, [remove("wall-rear-kitchen")]);
