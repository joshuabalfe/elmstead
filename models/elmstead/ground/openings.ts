/**
 * Ground-floor doors and windows: which component (../components), which wall, where along it, its
 * size, and which way doors swing.
 *
 * The drawing gives widths only. Door heights are a typical 2.1 m; the bathroom door's drawn gap
 * (about 440 mm) uses the owner's 768 mm internal-door width. The front window, fanlight, front
 * door opening and frame, and the bedroom window's sill and head, are the owner's.
 */
import { add, centredOn, deg, div, divRound, door, doorway, face, m, mid, mm, scale, sub, window, type Opening } from "../../../src/model/index.js";
import { fanlight, framedWindow, frontDoor, frontWindow, internalDoor, smallPaneWindow } from "../components/index.js";
import { living } from "./rooms.js";
import { bathFrontX, bedroomBathroom, bedroomWallY, rear, extRear, livingBedroom, lobbyBathroom, lobbyScreen, lobbyScreenLobbyStart, lobbyScreenLobbyVisibleLength, partyIn, partitionRear, endIn, front } from "./walls.js";

const doorH = m(2.1);
const internal = { width: mm(768), height: doorH };
const standard = { height: m(1.2), sillHeight: mm(900) };

// Front door, with the fanlight over it and the large front window beside it: the two share a head.
// The owner's 1 m opening takes a 50 mm frame, leaving a 900 mm leaf; the fanlight sits between
// the frame's jambs.
const frontDoorFrame = mm(50);
export const frontDoorWidth = mm(1000);
const frontDoorSize = { width: frontDoorWidth, height: doorH };
export const frontDoorOffset = mm(150); // from the party-wall end of the front wall (owner)
/** Centre of the front door, shared with the step railings and the front facade railing. */
export const frontDoorCentreY = sub(sub(partyIn, frontDoorOffset), div(frontDoorWidth, 2));
const frontHead = m(2.6);
const transom = mm(100); // between the top of the door and the fanlight
const frontWindowSize = { width: m(2.5), height: sub(frontHead, mm(500)), sillHeight: mm(500) };
const fanlightWidth = sub(frontDoorSize.width, scale(frontDoorFrame, 2));
const fanlightOffset = add(frontDoorOffset, frontDoorFrame);
const fanlightSill = add(frontDoorSize.height, transom);
const frontWindowCentreY = mid(living.outline[1]!.y, living.outline[2]!.y); // centred on the living room
const bathroomDoorOffset = mm(135);
const bathroomDoorY = add(face(bedroomBathroom, "north"), bathroomDoorOffset); // the living-room door sits opposite it
const lobbyCentreX = mid(partitionRear, bathFrontX);
// The lobby doorway is centred on the screen's lobby-side face, with a jamb each side.
const lobbyDoorwayOffset = add(lobbyScreenLobbyStart, divRound(sub(lobbyScreenLobbyVisibleLength, internal.width), 2));
// Window returns splay out at about 45° on the inside. The frame is taken as sitting in the middle
// of the wall, where the splay starts.
const insideReveal = { face: "left", angle: deg(45) } as const;
// Bedroom window hugs the bathroom end of the rear wall: 200 mm of wall left to the partition (chosen, not measured).
const bedroomWindowGap = mm(200);
const bedroomWindowWidth = mm(1200);
const bedroomWindowOffset = sub(sub(bedroomWallY, bedroomWindowGap), add(endIn, bedroomWindowWidth));
// The bedroom window's sill is 500 mm off the floor and its head is at 2650 mm (owner).
const bedroomWindowSill = mm(500);
const bedroomWindowHead = mm(2650);
const bedroomWindowSize = { width: bedroomWindowWidth, height: sub(bedroomWindowHead, bedroomWindowSill), sillHeight: bedroomWindowSill };

export const openings: Opening[] = [
  // Front wall runs plan north→south, so "start" is its party-wall end and "left" is inside.
  door("door-front", front, frontDoorOffset, frontDoor, frontDoorSize, { hinge: "start", side: "left" }),
  window("window-front-fanlight", front, fanlightOffset, fanlight, { width: fanlightWidth, height: sub(frontHead, fanlightSill), sillHeight: fanlightSill }),
  window("window-living", front, centredOn(front, frontWindowCentreY, frontWindowSize.width), frontWindow, frontWindowSize, insideReveal),

  // Partition runs plan south→north; "left" is the living room.
  door("door-living", livingBedroom, sub(bathroomDoorY, endIn), internalDoor, internal, { hinge: "start", side: "left" }),
  // Bedroom/bathroom wall runs plan west→east; "right" is the bedroom. Centred on the lobby.
  door("door-bedroom", bedroomBathroom, centredOn(bedroomBathroom, lobbyCentreX, internal.width), internalDoor, internal, { hinge: "start", side: "right" }),
  // Lobby/bathroom wall runs plan south→north; "right" is the bathroom.
  door("door-bathroom", lobbyBathroom, bathroomDoorOffset, internalDoor, internal, { hinge: "start", side: "right" }),
  // Screen runs from the hall corner (plan south-west) to the spine (plan north-east); "right" is the lobby.
  doorway("door-lobby", lobbyScreen, lobbyDoorwayOffset, internal),

  window("window-bedroom", rear, bedroomWindowOffset, smallPaneWindow, bedroomWindowSize, insideReveal),
  // Lowered to sit under the main half landing, where the extension wall stops; its position awaits
  // the rear-hall plan, which drops the rear hall to the basement half landing.
  window("window-rear-hall", extRear, mm(700), framedWindow, { ...standard, sillHeight: mm(200), width: mm(950) }),
];
