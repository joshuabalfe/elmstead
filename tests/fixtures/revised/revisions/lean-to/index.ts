// A folder revision: the cottage with a lean-to off its north wall.
import { addTo, revise } from "../../../../../src/model/index.js";
import base from "../../index.js";
import { leanToWalls } from "../shared/lean-to-walls.js";
import { openings } from "./openings.js";

export default revise(base, [addTo("storey-ground", { walls: leanToWalls, openings })]);
