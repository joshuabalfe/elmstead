// A hand-built revision (not through revise) with a storey its base does not have.
import { mm, type BuildingModel } from "../../../../src/backend/model/index.js";
import base from "../index.js";

const revision: BuildingModel = structuredClone(base);
revision.storeys.push({
  id: "storey-loft",
  name: "Loft",
  elevation: mm(2600),
  walls: [],
  openings: [],
  slabs: [],
  rooms: [],
});
export default revision;
