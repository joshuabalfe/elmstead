import cottage from "../../models/example-cottage/index.js";

// Same as the cottage, with its first opening naming a wall that does not exist.
const broken = structuredClone(cottage) as any;
broken.storeys[0].openings[0].wallId = "wall-missing";
export default broken;