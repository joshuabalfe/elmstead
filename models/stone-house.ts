/**
 * Stone house: single storey, traced from a supplied plan image (first pass).
 * 8 m × 7.4 m stone core with a brick extension at the rear, north-east corner.
 *
 *   +----------------------------+--------+   north
 *   |  Hallway        | stairs   | rear   |
 *   |                 |  (n/a)   | hall   |
 *   +--------------+ \ +----------+--------+
 *   |              | Lobby| Bathroom |
 *   |  Living room |  +---+----------+
 *   |              |  |   Bedroom   |
 *   +--------------+--+-------------+   south
 *   front door on the west wall
 *
 * Plan origin is the outside south-west corner of the core; x east, y north, mm. "North" is
 * the top of the source drawing, which has no north arrow.
 *
 * Measured from the image at 8 m = 1689 px (about 4.74 mm per px), rounded to 25 mm. Ceiling height
 * (2.9 m) is from the owner; door and window heights are not in the drawing and use typical
 * values. Left out for now: the stairs, front steps, hearths,
 * radiators and rainwater pipes.
 */
import { add, centredOn, defineBuilding, door, face, m, mm, pt, sub, wall, window, type Opening, type Room } from "../src/model/index.js";

// ── Overall ──────────────────────────────────────────────────────────────────
const coreW = m(8);
const coreD = m(7.4);
const extEastX = m(9.4); //  outside face of the extension's east wall
const extSouthY = m(5); //   outside face of the extension's south wall
const wallH = m(2.9); //      floor to ceiling; walls stop at the ceiling until there is an upper floor

// ── Wall thicknesses ─────────────────────────────────────────────────────────
const westT = mm(450); //  front wall, stone
const northT = mm(350); // stone, continues across the extension
const eastT = mm(350); //  stone
const southT = mm(250); // stone
const brickT = mm(175); // extension walls
const partT = mm(175); //  internal partitions
const studT = mm(100); //  bathroom's north wall and the lobby screen
const breastT = mm(350); // chimney breast / thickened wall projecting from the south wall

// ── Internal layout (plan faces) ─────────────────────────────────────────────
const partitionX = mm(4025); //  west face of the living/bedroom partition
const hallWallY = mm(5525); //   south face of the hall/living wall
const bedroomWallY = mm(3515); // south face of the bedroom/bathroom wall
const bathWestX = mm(5205); //   west face of the lobby/bathroom wall
const bathNorthY = mm(5100); //  south face of the bathroom's north wall
const spineY = mm(6025); //      south face of the wall between the stair flights
const spineEastX = mm(7920);
const livingBreast = { west: mm(1050), east: mm(3425) };

// ── Openings ─────────────────────────────────────────────────────────────────
const extDoor = { width: mm(900), height: m(2.1) };
const intDoor = { width: mm(700), height: m(2.1) };
const sill = mm(900);
const windowH = m(1.2);
// Large front window: dimensions from the owner. Its centre is where the drawing shows it.
const frontWindow = { width: m(2.5), sillHeight: mm(500), headHeight: m(2.6), centreY: mm(3025) };
// Glazed fanlight over the front door: same width as the door, above a 100 mm transom, head level with the front window.
const frontDoorOffset = mm(50);
const transom = mm(100);
const fanlightSill = add(extDoor.height, transom);

// ── External walls (counter-clockwise, body on the left = inside) ────────────
const north = wall("wall-north", pt(extEastX, coreD), pt(mm(0), coreD), { thickness: northT, height: wallH, justification: "left" });
const south = wall("wall-south", pt(mm(0), mm(0)), pt(coreW, mm(0)), { thickness: southT, height: wallH, justification: "left" });
const southIn = face(south, "north");
const northIn = face(north, "south");
const west = wall("wall-west", pt(mm(0), northIn), pt(mm(0), southIn), { thickness: westT, height: wallH, justification: "left" });
const westIn = face(west, "east");

// Bathroom north wall first: the core's east wall stops at its north face, where the extension opens off.
const bathNorth = wall("wall-bathroom-north", pt(sub(coreW, eastT), bathNorthY), pt(bathWestX, bathNorthY), { thickness: studT, height: wallH, justification: "right" });
const east = wall("wall-east", pt(coreW, southIn), pt(coreW, face(bathNorth, "north")), { thickness: eastT, height: wallH, justification: "left" });
const eastIn = face(east, "west");

const extEast = wall("wall-extension-east", pt(extEastX, extSouthY), pt(extEastX, northIn), { thickness: brickT, height: wallH, justification: "left" });
const extSouth = wall("wall-extension-south", pt(coreW, extSouthY), pt(face(extEast, "west"), extSouthY), { thickness: brickT, height: wallH, justification: "left" });

// Chimney breast in the living room and the thickened wall along the bedroom, both against the south wall.
const breastLiving = wall("wall-breast-living", pt(livingBreast.west, southIn), pt(livingBreast.east, southIn), { thickness: breastT, height: wallH, justification: "left" });

// ── Internal walls ───────────────────────────────────────────────────────────
const inner = { thickness: partT, height: wallH };
const livingBedroom = wall("wall-living-bedroom", pt(partitionX, southIn), pt(partitionX, hallWallY), { ...inner, justification: "right" });
const partitionEast = face(livingBedroom, "east");
// Runs over the partition's top so the corner is closed.
const hallLiving = wall("wall-hall-living", pt(westIn, hallWallY), pt(partitionEast, hallWallY), { ...inner, justification: "left" });
const breastBedroom = wall("wall-breast-bedroom", pt(partitionEast, southIn), pt(eastIn, southIn), { thickness: breastT, height: wallH, justification: "left" });
const bedroomBathroom = wall("wall-bedroom-bathroom", pt(partitionEast, bedroomWallY), pt(eastIn, bedroomWallY), { ...inner, justification: "left" });
const lobbyBathroom = wall("wall-lobby-bathroom", pt(bathWestX, face(bedroomBathroom, "north")), pt(bathWestX, face(bathNorth, "north")), { ...inner, justification: "right" });
const spine = wall("wall-stair-spine", pt(mm(4650), spineY), pt(spineEastX, spineY), { ...inner, justification: "left" });
// Diagonal screen from the hall wall's corner to the end of the stair spine, holding the lobby door.
const lobbyScreen = wall("wall-lobby-screen", pt(partitionEast, face(hallLiving, "north")), spine.start, { thickness: studT, height: wallH, justification: "centre" });

// ── Openings ─────────────────────────────────────────────────────────────────
const win = (width: number) => ({ width: mm(width), height: windowH, sillHeight: sill });

const openings: Opening[] = [
  // West wall runs north→south, so "start" is the north end and "left" is inside.
  door("door-front", west, frontDoorOffset, extDoor, { hinge: "start", side: "left" }),
  window("window-front-fanlight", west, frontDoorOffset, {
    width: extDoor.width,
    height: sub(frontWindow.headHeight, fanlightSill),
    sillHeight: fanlightSill,
  }),
  window("window-living", west, centredOn(west, frontWindow.centreY, frontWindow.width), {
    width: frontWindow.width,
    height: sub(frontWindow.headHeight, frontWindow.sillHeight),
    sillHeight: frontWindow.sillHeight,
  }),

  // Partition runs south→north; "left" is the living room.
  door("door-living", livingBedroom, sub(mm(3955), southIn), intDoor, { hinge: "start", side: "left" }),
  // Bedroom/bathroom wall runs west→east; "right" is the bedroom.
  door("door-bedroom", bedroomBathroom, mm(190), intDoor, { hinge: "start", side: "right" }),
  // Lobby/bathroom wall runs south→north; "right" is the bathroom.
  door("door-bathroom", lobbyBathroom, mm(135), intDoor, { hinge: "start", side: "right" }),
  // Screen runs from the hall corner (south-west) to the spine (north-east); "right" is the lobby.
  door("door-lobby", lobbyScreen, mm(0), { width: mm(550), height: m(2.1) }, { hinge: "start", side: "right" }),

  window("window-bedroom", east, sub(mm(2285), southIn), win(1050)),
  window("window-rear-hall", extEast, mm(700), win(950)),
];

// ── Rooms ────────────────────────────────────────────────────────────────────
const hallNorthFace = face(hallLiving, "north");
const spineNorth = face(spine, "north");
const stairWestX = mm(5050); // where the stair footprint starts north of the spine

const rooms: Room[] = [
  {
    id: "room-living",
    name: "Living room",
    outline: [
      pt(westIn, southIn),
      pt(livingBreast.west, southIn),
      pt(livingBreast.west, face(breastLiving, "north")),
      pt(livingBreast.east, face(breastLiving, "north")),
      pt(livingBreast.east, southIn),
      pt(partitionX, southIn),
      pt(partitionX, hallWallY),
      pt(westIn, hallWallY),
    ],
  },
  {
    id: "room-hallway",
    name: "Hallway",
    outline: [
      pt(westIn, hallNorthFace),
      pt(partitionEast, hallNorthFace),
      spine.start,
      pt(spine.start.x, spineNorth),
      pt(stairWestX, spineNorth),
      pt(stairWestX, northIn),
      pt(westIn, northIn),
    ],
  },
  {
    id: "room-lobby",
    name: "Lobby",
    outline: [
      pt(partitionEast, face(bedroomBathroom, "north")),
      pt(bathWestX, face(bedroomBathroom, "north")),
      pt(bathWestX, spineY),
      spine.start,
      pt(partitionEast, hallNorthFace),
    ],
  },
  {
    id: "room-bedroom",
    name: "Bedroom",
    outline: [
      pt(partitionEast, face(breastBedroom, "north")),
      pt(eastIn, face(breastBedroom, "north")),
      pt(eastIn, bedroomWallY),
      pt(partitionEast, bedroomWallY),
    ],
  },
  {
    id: "room-bathroom",
    name: "Bathroom",
    outline: [
      pt(face(lobbyBathroom, "east"), face(bedroomBathroom, "north")),
      pt(eastIn, face(bedroomBathroom, "north")),
      pt(eastIn, bathNorthY),
      pt(face(lobbyBathroom, "east"), bathNorthY),
    ],
  },
  {
    id: "room-rear-hall",
    name: "Rear hall",
    outline: [
      pt(spineEastX, face(extSouth, "north")),
      pt(face(extEast, "west"), face(extSouth, "north")),
      pt(face(extEast, "west"), northIn),
      pt(mm(8975), northIn),
      pt(mm(8975), spineNorth),
      pt(spineEastX, spineNorth),
    ],
  },
];

export default defineBuilding({
  project: { id: "project-stone-house", name: "Stone house" },
  site: { id: "site-default", name: "Default site" },
  building: { id: "building-stone-house", name: "Stone house" },
  storeys: [
    {
      id: "storey-ground",
      name: "Ground floor",
      elevation: mm(0),
      walls: [north, south, west, east, extEast, extSouth, breastLiving, breastBedroom, hallLiving, livingBedroom, bedroomBathroom, lobbyBathroom, bathNorth, spine, lobbyScreen],
      openings,
      slabs: [
        {
          id: "slab-ground",
          name: "Ground floor slab",
          outline: [pt(mm(0), mm(0)), pt(coreW, mm(0)), pt(coreW, extSouthY), pt(extEastX, extSouthY), pt(extEastX, coreD), pt(mm(0), coreD)],
          thickness: mm(150),
          elevationOffset: mm(0),
        },
      ],
      rooms,
    },
  ],
});
