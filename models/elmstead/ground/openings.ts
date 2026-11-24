/**
 * Ground-floor doors and windows: which component (../components), which wall, where along it, its
 * size, and which way doors swing.
 *
 * The drawing gives widths only. Door heights are a typical 2.1 m; the bathroom door's drawn gap
 * (about 440 mm) is taken as 700. The front window, fanlight, and front door opening and frame
 * sizes are the owner's.
 */
import { add, centredOn, deg, divRound, door, doorway, face, m, mm, scale, sub, window, type Opening } from "../../../src/model/index.js";
import { fanlight, frontDoor, frontWindow, internalDoor, standardWindow } from "../components/index.js";
import { living } from "./rooms.js";
import { bathWestX, bedroomBathroom, bedroomWallY, east, extEast, livingBedroom, lobbyBathroom, lobbyScreen, lobbyScreenTuck, lobbyScreenVisibleLength, partitionEast, southIn, west } from "./walls.js";

const doorH = m(2.1);
const internal = { width: mm(768), height: doorH };
const standard = { height: m(1.2), sillHeight: mm(900) };

// Front door, with the fanlight over it and the large front window beside it: the two share a head.
// The owner's 1 m opening takes a 50 mm frame, leaving a 900 mm leaf; the fanlight sits between
// the frame's jambs.
const frontDoorFrame = mm(50);
export const frontDoorWidth = mm(1000);
const front = { width: frontDoorWidth, height: doorH };
export const frontDoorOffset = mm(150); // from the north end of the west wall (owner)
const frontHead = m(2.6);
const transom = mm(100); // between the top of the door and the fanlight
const frontWindowSize = { width: m(2.5), height: sub(frontHead, mm(500)), sillHeight: mm(500) };
const fanlightWidth = sub(front.width, scale(frontDoorFrame, 2));
const fanlightOffset = add(frontDoorOffset, frontDoorFrame);
const fanlightSill = add(front.height, transom);
const frontWindowCentreY = mm(Math.round((living.outline[1]!.y + living.outline[2]!.y) / 2)); // centred on the living room
const bathroomDoorOffset = mm(135);
const bathroomDoorY = add(face(bedroomBathroom, "north"), bathroomDoorOffset); // the living-room door sits opposite it
const lobbyCentreX = mm(Math.round((partitionEast + bathWestX) / 2));
const lobbyDoor = { width: mm(550), height: doorH }; // narrower than the others, to fit the screen
const lobbyDoorOffset = add(lobbyScreenTuck, divRound(sub(lobbyScreenVisibleLength, lobbyDoor.width), 2));
// Window returns splay out at about 45° on the inside. The frame is taken as sitting in the middle
// of the wall, where the splay starts.
const insideReveal = { face: "left", angle: deg(45) } as const;
// Bedroom window hugs the bathroom end of the east wall: 200 mm of wall left to the partition (chosen, not measured).
const bedroomWindowGap = mm(200);
const bedroomWindowWidth = mm(1200);
const bedroomWindowOffset = sub(sub(bedroomWallY, bedroomWindowGap), add(southIn, bedroomWindowWidth));

export const openings: Opening[] = [
  // West wall runs north→south, so "start" is the north end and "left" is inside.
  door("door-front", west, frontDoorOffset, frontDoor, front, { hinge: "start", side: "left" }),
  window("window-front-fanlight", west, fanlightOffset, fanlight, { width: fanlightWidth, height: sub(frontHead, fanlightSill), sillHeight: fanlightSill }),
  window("window-living", west, centredOn(west, frontWindowCentreY, frontWindowSize.width), frontWindow, frontWindowSize, insideReveal),

  // Partition runs south→north; "left" is the living room.
  door("door-living", livingBedroom, sub(bathroomDoorY, southIn), internalDoor, internal, { hinge: "start", side: "left" }),
  // Bedroom/bathroom wall runs west→east; "right" is the bedroom. Centred on the lobby.
  door("door-bedroom", bedroomBathroom, centredOn(bedroomBathroom, lobbyCentreX, internal.width), internalDoor, internal, { hinge: "start", side: "right" }),
  // Lobby/bathroom wall runs south→north; "right" is the bathroom.
  door("door-bathroom", lobbyBathroom, bathroomDoorOffset, internalDoor, internal, { hinge: "start", side: "right" }),
  // Screen runs from the hall corner (south-west) to the spine (north-east); "right" is the lobby.
  doorway("door-lobby", lobbyScreen, lobbyDoorOffset, lobbyDoor),

  window("window-bedroom", east, bedroomWindowOffset, standardWindow, { ...standard, width: bedroomWindowWidth }, insideReveal),
  window("window-rear-hall", extEast, mm(700), standardWindow, { ...standard, width: mm(950) }),
];
