// A revision that widens the living-room window, which base constraints measure.
import { mm, replace, revise, type Window } from "../../../../src/model/index.js";
import base from "../index.js";

const living = base.storeys[0]!.openings.find((o) => o.id === "window-living") as Window;
export const wideWindow: Window = {
  ...living,
  offsetAlongWall: mm(living.offsetAlongWall - 300),
  width: mm(living.width + 600),
};
export default revise(base, [replace(wideWindow)]);
