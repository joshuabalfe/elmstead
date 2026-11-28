/**
 * Example cottage, furnished: an illustrative proposal that puts one of every kind of furnishing in
 * the cottage, to show how furniture and sanitary fittings are written.
 *
 *   +-----------+------+------------+   north
 *   | sink      |      | bath       |
 *   |  table    | Hall | basin      |
 *   |  chair    |      | shower  wc |
 *   +-----------+      +------------+
 *   | sofa      |      | shelf desk |
 *   | cabinet   |      | bed        |
 *   +-----------+------+------------+   south
 *
 * Every position comes from a room outline, which is made of wall faces, so a furnishing that
 * stands against a wall keeps standing against it if the wall is thickened. Sizes are the kinds'
 * defaults, except where an item stands flush against a wall and its size sets where it goes.
 */
import { addTo, deg, furnishing, mm, pt, revise } from "../../../../src/backend/model/index.js";
import base from "../index.js";

const ground = base.storeys[0]!;

/** A room's four faces, from its outline (west and south corner first, then east, then north). */
function room(id: string) {
  const outline = ground.rooms.find((r) => r.id === id)!.outline;
  return { west: outline[0]!.x, east: outline[1]!.x, south: outline[0]!.y, north: outline[2]!.y };
}
const living = room("room-living");
const kitchen = room("room-kitchen");
const bedroom = room("room-bedroom");
const bathroom = room("room-bathroom");

const at = (x: number, y: number) => pt(mm(x), mm(y));
const middle = (a: number, b: number) => (a + b) / 2;

// Living room: a sofa with its back against the wall to the kitchen, and a filing cabinet by the hall.
const sofa = furnishing("sofa-living", "sofa", at(middle(living.west, living.east), living.north - 450));
const cabinet = furnishing("file-cabinet-living", "file-cabinet", at(living.east - 225, living.south + 450));

// Kitchen: a sink under the back wall, a table in the middle and a chair turned a little at it.
const sink = furnishing("sink-kitchen", "sink", at(kitchen.west + 1000, kitchen.north - 300));
const table = furnishing(
  "table-kitchen",
  "table",
  at(middle(kitchen.west, kitchen.east), middle(kitchen.south, kitchen.north) - 400),
);
const chair = furnishing(
  "chair-kitchen",
  "chair",
  at(middle(kitchen.west, kitchen.east) - 300, middle(kitchen.south, kitchen.north) - 750),
  {
    rotation: deg(30),
  },
);

// Bedroom: the bed's head against the north wall, a desk and a raised shelf against the east wall.
// Turned a quarter turn the desk (1400 by 700) is 700 across, and the shelf (800 by 300) 300 across,
// whose back is turned to the wall by three quarter turns.
const bed = furnishing("bed-bedroom", "bed", at(bedroom.west + 1100, bedroom.north - 1000));
const desk = furnishing("desk-bedroom", "desk", at(bedroom.east - 350, bedroom.south + 900), { rotation: deg(90) });
const shelf = furnishing("shelf-bedroom", "shelf", at(bedroom.east - 150, bedroom.south + 2100), {
  rotation: deg(270),
  elevationOffset: mm(900),
  height: mm(600),
});

// Bathroom: a bath along the north wall, a shower in the south-west corner, a toilet with its
// cistern against the south wall (turned half a turn), and a basin by the north wall.
const bath = furnishing("bath-bathroom", "bath", at(bathroom.east - 850, bathroom.north - 350));
const shower = furnishing("shower-bathroom", "shower", at(bathroom.west + 450, bathroom.south + 450));
const toilet = furnishing("toilet-bathroom", "toilet", at(bathroom.east - 900, bathroom.south + 350), {
  rotation: deg(180),
});
const basin = furnishing("wash-basin-bathroom", "wash-basin", at(bathroom.west + 575, bathroom.north - 225));

export default revise(base, [
  addTo("storey-ground", {
    furnishings: [sofa, cabinet, sink, table, chair, bed, desk, shelf, bath, shower, toilet, basin],
  }),
]);
