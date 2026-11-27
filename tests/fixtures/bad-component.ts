import cottage from "../../models/examples/example-cottage/index.js";

// Same as the cottage, with its front door naming a component that does not exist.
const broken = structuredClone(cottage) as any;
broken.storeys[0].openings[0].componentId = "door-type-missing";
export default broken;
