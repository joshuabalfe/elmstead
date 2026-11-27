// Helpers shared by revisions: a folder under revisions/ without an index.ts is not a revision.
import { mm, pt, wall } from "../../../../../src/backend/model/index.js";

const leanTo = { thickness: mm(100), height: mm(2400) };
export const leanToWalls = [
  wall("wall-lean-to-west", pt(mm(3000), mm(6000)), pt(mm(3000), mm(7500)), leanTo),
  wall("wall-lean-to-north", pt(mm(3000), mm(7500)), pt(mm(6000), mm(7500)), leanTo),
  wall("wall-lean-to-east", pt(mm(6000), mm(7500)), pt(mm(6000), mm(6000)), leanTo),
];
