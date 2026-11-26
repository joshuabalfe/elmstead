// A file revision: the cottage with its kitchen window bricked up.
import { remove, revise } from "../../../../src/model/index.js";
import base from "../index.js";

export default revise(base, [remove("window-kitchen")]);
