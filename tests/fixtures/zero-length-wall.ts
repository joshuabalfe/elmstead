import cottage from "../../models/example-cottage.js";

// Same as the cottage, with the south wall collapsed to a point.
const broken = structuredClone(cottage) as any;
broken.storeys[0].walls[0].end = { ...broken.storeys[0].walls[0].start };
export default broken;