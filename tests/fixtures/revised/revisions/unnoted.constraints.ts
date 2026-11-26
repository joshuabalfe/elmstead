import { removeConstraint, reviseConstraints } from "../../../../src/constraints/index.js";
import base from "../constraints.js";

export default reviseConstraints(base, [removeConstraint("hall-width", "")]);
