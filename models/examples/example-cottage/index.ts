/**
 * Example cottage: single storey, 8 m × 6 m overall, south-facing front.
 *
 *   +-----------+------+------------+   north
 *   |  Kitchen  |      |  Bathroom  |
 *   +-----------+ Hall +------------+
 *   |  Living   |      |  Bedroom   |
 *   +-----------+------+------------+   south (front door)
 *
 * Plan origin is the outside south-west corner. x east, y north, mm.
 */
import {
  centredOn,
  defineBuilding,
  door,
  doorComponent,
  face,
  m,
  mid,
  mm,
  pt,
  rectRoom,
  rectWalls,
  wall,
  window,
  windowComponent,
  type Opening,
} from "../../../src/model/index.js";

// ── Key dimensions ────────────────────────────────────────────────────────────
const houseWidth = m(8);
const houseDepth = m(6);
const extWallT = mm(200);
const intWallT = mm(100);
const wallH = m(2.4);

const hallWestX = m(3.8); // centreline of the hall's west wall
const hallEastX = m(5); //   centreline of the hall's east wall
const livingDepth = m(3.4); // centreline of the living/kitchen wall, from the outside south face
const bedroomDepth = m(3.8); // centreline of the bedroom/bathroom wall

// ── Openings ─────────────────────────────────────────────────────────────────
const windowW = m(1.2); // every window shares this width
const windowH = m(1.2);
const windowSill = mm(900);
const extDoor = { width: mm(900), height: m(2.1) };
const intDoor = { width: mm(800), height: m(2.1) };

// Door and window designs (the building's `components`): each opening says which one it is.
const externalDoor = doorComponent("door-type-external", "External door");
const internalDoor = doorComponent("door-type-internal", "Internal door");
const sash = windowComponent("window-type-sash", "Sash window");

// ── Walls ────────────────────────────────────────────────────────────────────
const ext = rectWalls("wall", pt(mm(0), mm(0)), houseWidth, houseDepth, { thickness: extWallT, height: wallH });
const inner = { thickness: intWallT, height: wallH };

const southIn = face(ext.south, "north");
const northIn = face(ext.north, "south");
const westIn = face(ext.west, "east");
const eastIn = face(ext.east, "west");

const hallWest = wall("wall-hall-west", pt(hallWestX, southIn), pt(hallWestX, northIn), inner);
const hallEast = wall("wall-hall-east", pt(hallEastX, southIn), pt(hallEastX, northIn), inner);
const livingKitchen = wall("wall-living-kitchen", pt(westIn, livingDepth), pt(face(hallWest, "west"), livingDepth), inner);
const bedroomBathroom = wall("wall-bedroom-bathroom", pt(face(hallEast, "east"), bedroomDepth), pt(eastIn, bedroomDepth), inner);

// ── Rooms (outlines are wall faces, so they follow any thickness change) ─────
const hall = rectRoom("room-hall", "Hall", { west: face(hallWest, "east"), east: face(hallEast, "west"), south: southIn, north: northIn });
const living = rectRoom("room-living", "Living room", { west: westIn, east: face(hallWest, "west"), south: southIn, north: face(livingKitchen, "south") });
const kitchen = rectRoom("room-kitchen", "Kitchen", { west: westIn, east: face(hallWest, "west"), south: face(livingKitchen, "north"), north: northIn });
const bedroom = rectRoom("room-bedroom", "Bedroom", { west: face(hallEast, "east"), east: eastIn, south: southIn, north: face(bedroomBathroom, "south") });
const bathroom = rectRoom("room-bathroom", "Bathroom", { west: face(hallEast, "east"), east: eastIn, south: face(bedroomBathroom, "north"), north: northIn });

/** Room-outline centres in each axis — used to centre windows and doors on rooms. */
const xMid = (r: typeof hall) => mid(r.outline[0]!.x, r.outline[1]!.x);
const yMid = (r: typeof hall) => mid(r.outline[1]!.y, r.outline[2]!.y);

const win = { width: windowW, height: windowH, sillHeight: windowSill };

const openings: Opening[] = [
  // External doors open inwards (the inside is to the left of every external wall).
  door("door-front", ext.south, centredOn(ext.south, xMid(hall), extDoor.width), externalDoor, extDoor, { hinge: "start", side: "left" }),
  door("door-back", ext.north, centredOn(ext.north, xMid(hall), extDoor.width), externalDoor, extDoor, { hinge: "end", side: "left" }),

  // Hall walls run south→north, so "left" is west and "right" is east.
  door("door-living", hallWest, centredOn(hallWest, yMid(living), intDoor.width), internalDoor, intDoor, { hinge: "start", side: "left" }),
  door("door-kitchen", hallWest, centredOn(hallWest, yMid(kitchen), intDoor.width), internalDoor, intDoor, { hinge: "end", side: "left" }),
  door("door-bedroom", hallEast, centredOn(hallEast, yMid(bedroom), intDoor.width), internalDoor, intDoor, { hinge: "start", side: "right" }),
  door("door-bathroom", hallEast, centredOn(hallEast, yMid(bathroom), intDoor.width), internalDoor, intDoor, { hinge: "end", side: "right" }),

  window("window-living", ext.south, centredOn(ext.south, xMid(living), windowW), sash, win),
  window("window-bedroom", ext.south, centredOn(ext.south, xMid(bedroom), windowW), sash, win),
  window("window-kitchen", ext.north, centredOn(ext.north, xMid(kitchen), windowW), sash, win),
  window("window-bathroom", ext.east, centredOn(ext.east, yMid(bathroom), windowW), sash, win),
];

export default defineBuilding({
  project: { id: "project-elmstead", name: "Elmstead" },
  site: { id: "site-default", name: "Default site" },
  building: { id: "building-cottage", name: "Example cottage" },
  components: { doors: [externalDoor, internalDoor], windows: [sash] },
  storeys: [
    {
      id: "storey-ground",
      name: "Ground floor",
      elevation: mm(0),
      walls: [ext.south, ext.east, ext.north, ext.west, hallWest, hallEast, livingKitchen, bedroomBathroom],
      openings,
      slabs: [
        {
          id: "slab-ground",
          name: "Ground floor slab",
          outline: [pt(mm(0), mm(0)), pt(houseWidth, mm(0)), pt(houseWidth, houseDepth), pt(mm(0), houseDepth)],
          thickness: mm(150),
          elevationOffset: mm(0),
        },
      ],
      rooms: [living, hall, kitchen, bedroom, bathroom],
    },
  ],
});
