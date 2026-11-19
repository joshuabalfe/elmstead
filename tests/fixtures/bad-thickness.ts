import cottage from "../../models/example-cottage.js";

// Same as the cottage, with one wall made invalid as plain JSON would be.
const broken = structuredClone(cottage) as any;
broken.storeys[0].walls[4].thickness = 0;
export default broken;
