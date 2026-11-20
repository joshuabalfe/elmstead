/**
 * Ground-floor doors and windows: which component (../components), which wall, where along it, its
 * size, and which way doors swing.
 *
 * The drawing gives widths only. Door heights are a typical 2.1 m; the bathroom door's drawn gap
 * (about 440 mm) is taken as 700. The front window and fanlight sizes are the owner's.
 */
import { wallLength } from "../../../src/geometry/wall.js";
import { add, centredOn, deg, door, face, m, mm, sub, window, type Opening } from "../../../src/model/index.js";
import { fanlight, frontDoor, frontWindow, internalDoor, standardWindow } from "../components/index.js";
import { living } from "./rooms.js";
import { bathWestX, bedroomBathroom, east, extEast, livingBedroom, lobbyBathroom, lobbyScreen, partitionEast, southIn, west } from "./walls.js";

const doorH = m(2.1);
const internal = { width: mm(700), height: doorH };
const standard = { height: m(1.2), sillHeight: mm(900) };

// Front door, with the fanlight over it and the large front window beside it: the two share a head.
const front = { width: mm(900), height: doorH };
const frontDoorOffset = mm(50);
const frontHead = m(2.6);
const transom = mm(100); // between the top of the door and the fanlight
const frontWindowSize = { width: m(2.5), height: sub(frontHead, mm(500)), sillHeight: mm(500) };
const fanlightSill = add(front.height, transom);
const frontWindowCentreY = mm(Math.round((living.outline[1]!.y + living.outline[2]!.y) / 2)); // centred on the living room
const bathroomDoorOffset = mm(135);
const bathroomDoorY = add(face(bedroomBathroom, "north"), bathroomDoorOffset); // the living-room door sits opposite it
const lobbyCentreX = mm(Math.round((partitionEast + bathWestX) / 2));
const lobbyDoor = { width: mm(550), height: doorH }; // narrower than the others, to fit the screen
// The front window's returns splay out at about 45° on the inside. The frame is taken as sitting in
// the middle of the wall, where the splay starts.
const frontWindowReveal = { face: "left", angle: deg(45) } as const;

export const openings: Opening[] = [
  // West wall runs north→south, so "start" is the north end and "left" is inside.
  door("door-front", west, frontDoorOffset, frontDoor, front, { hinge: "start", side: "left" }),
  window("window-front-fanlight", west, frontDoorOffset, fanlight, { width: front.width, height: sub(frontHead, fanlightSill), sillHeight: fanlightSill }),
  window("window-living", west, centredOn(west, frontWindowCentreY, frontWindowSize.width), frontWindow, frontWindowSize, frontWindowReveal),

  // Partition runs south→north; "left" is the living room.
  door("door-living", livingBedroom, sub(bathroomDoorY, southIn), internalDoor, internal, { hinge: "start", side: "left" }),
  // Bedroom/bathroom wall runs west→east; "right" is the bedroom. Centred on the lobby.
  door("door-bedroom", bedroomBathroom, centredOn(bedroomBathroom, lobbyCentreX, internal.width), internalDoor, internal, { hinge: "start", side: "right" }),
  // Lobby/bathroom wall runs south→north; "right" is the bathroom.
  door("door-bathroom", lobbyBathroom, bathroomDoorOffset, internalDoor, internal, { hinge: "start", side: "right" }),
  // Screen runs from the hall corner (south-west) to the spine (north-east); "right" is the lobby.
  door("door-lobby", lobbyScreen, mm(Math.round((wallLength(lobbyScreen) - lobbyDoor.width) / 2)), internalDoor, lobbyDoor, { hinge: "start", side: "right" }),

  window("window-bedroom", east, sub(mm(2285), southIn), standardWindow, { ...standard, width: mm(1050) }),
  window("window-rear-hall", extEast, mm(700), standardWindow, { ...standard, width: mm(950) }),
];
