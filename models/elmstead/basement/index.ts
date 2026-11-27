/**
 * Elmstead basement, traced from the owner's basement plan (first pass). It sits below the ground
 * floor at a provisional level (see ../shared.ts); the external walls stack on the shared runs.
 *
 *   +----------------------------+--------+   party wall
 *   |  Hallway        |          | rear   |
 *   +--------------+  |  Garden  | hall   |
 *   | Guest (left) |  |  Room    |(stair) |
 *   +--------------+  |          +--------+
 *   | Guest (right)|Sh|          |
 *   +--------------+--+----------+   end wall
 *
 * The internal stair flight in the extension and the well it climbs through are a later pass, so
 * the basement slab is solid here. It projects 900 mm beyond the front wall, out to the pavement
 * edge. An external stair at the front-right corner climbs from that path to the street: six steps,
 * a 900 mm square top landing, and a final rise onto the pavement. The front-wall piers and the
 * shower-room end-wall thickening await the eye check.
 */
import { add, mm, pt, scale, stair, stairFlight, stairLanding, sub, type Storey } from "../../../src/model/index.js";
import { basementFloor, coreD, coreW, extRearX, extRightY, frontStepGoing } from "../shared.js";
import { street } from "../street.js";
import { openings } from "./openings.js";
import { rooms } from "./rooms.js";
import { walls } from "./walls.js";

// Six steps climb towards the end wall along the external path to a 900 mm square top landing at
// the front-right corner, one riser below the street. The final rise steps towards the front
// through the railing gap onto the pavement. The landing fills the corner square between the path
// and the building.
const externalStairWidth = mm(900);
const externalStairCentreX = mm(-450);
const externalStairBottomY = add(externalStairWidth, scale(frontStepGoing, 5)); // landing depth + five goings
const externalStair: ReturnType<typeof stair> = stair("stair-basement-external", street, [
  stairFlight(
    "stair-flight-basement-external",
    pt(externalStairCentreX, externalStairBottomY),
    pt(externalStairCentreX, externalStairWidth),
    { width: externalStairWidth, risers: 6 },
  ),
  stairLanding(
    "stair-landing-basement-external",
    [
      pt(sub(mm(0), externalStairWidth), mm(0)),
      pt(mm(0), mm(0)),
      pt(mm(0), externalStairWidth),
      pt(sub(mm(0), externalStairWidth), externalStairWidth),
    ],
    { thickness: mm(150) },
  ),
]);

export const basement: Storey = {
  id: "storey-basement",
  name: "Basement",
  elevation: basementFloor.elevation,
  walls,
  openings,
  slabs: [
    {
      id: "slab-basement",
      name: "Basement slab",
      outline: [
        pt(mm(-900), mm(0)),
        pt(coreW, mm(0)),
        pt(coreW, extRightY),
        pt(extRearX, extRightY),
        pt(extRearX, coreD),
        pt(mm(-900), coreD),
      ],
      thickness: mm(150),
      elevationOffset: mm(0),
    },
  ],
  rooms,
  stairs: [externalStair],
};
