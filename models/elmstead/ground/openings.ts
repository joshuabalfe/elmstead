/**
 * Ground-floor doors and windows: which component (../components), which wall, where along it, and
 * which way doors swing.
 */
import { centredOn, door, mm, sub, window, type Opening } from "../../../src/model/index.js";
import { bedroomWindow, fanlight, frontDoor, frontHead, frontWindow, internalDoor, lobbyDoor, rearHallWindow } from "../components/index.js";
import { bedroomBathroom, east, extEast, livingBedroom, lobbyBathroom, lobbyScreen, southIn, west } from "./walls.js";

const sill = mm(900); // the usual window sill
const frontDoorOffset = mm(50);
const frontWindowCentreY = mm(3025); // where the drawing shows it

export const openings: Opening[] = [
  // West wall runs north→south, so "start" is the north end and "left" is inside.
  door("door-front", west, frontDoorOffset, frontDoor, { hinge: "start", side: "left" }),
  // Over the front door, head level with the front window's.
  window("window-front-fanlight", west, frontDoorOffset, fanlight, { sillHeight: sub(frontHead, fanlight.height) }),
  window("window-living", west, centredOn(west, frontWindowCentreY, frontWindow.width), frontWindow, { sillHeight: sub(frontHead, frontWindow.height) }),

  // Partition runs south→north; "left" is the living room.
  door("door-living", livingBedroom, sub(mm(3955), southIn), internalDoor, { hinge: "start", side: "left" }),
  // Bedroom/bathroom wall runs west→east; "right" is the bedroom.
  door("door-bedroom", bedroomBathroom, mm(190), internalDoor, { hinge: "start", side: "right" }),
  // Lobby/bathroom wall runs south→north; "right" is the bathroom.
  door("door-bathroom", lobbyBathroom, mm(135), internalDoor, { hinge: "start", side: "right" }),
  // Screen runs from the hall corner (south-west) to the spine (north-east); "right" is the lobby.
  door("door-lobby", lobbyScreen, mm(0), lobbyDoor, { hinge: "start", side: "right" }),

  window("window-bedroom", east, sub(mm(2285), southIn), bedroomWindow, { sillHeight: sill }),
  window("window-rear-hall", extEast, mm(700), rearHallWindow, { sillHeight: sill }),
];
