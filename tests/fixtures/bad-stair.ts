import twoStorey from "../../models/example-two-storey/index.js";

// Same as the two-storey model, with its half landing slid 100 mm east, off both flights' ends.
const broken = structuredClone(twoStorey) as any;
const landing = broken.storeys[0].stairs[0].segments[1];
landing.outline = landing.outline.map((p: any) => ({ x: p.x + 100, y: p.y }));
export default broken;
