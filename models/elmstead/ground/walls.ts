/**
 * Ground-floor walls, and the plan positions they are built from. Openings and rooms derive from
 * these, so this is the file to edit to move a wall.
 *
 * Measured from the owner's plan image at 8 m = 1689 px (about 4.74 mm per px), rounded to 25 mm.
 * The living room and hallway sizes are the owner's measurements, not traced.
 */
import { add, face, faceCrossing, mm, pt, sub, wall } from "../../../src/backend/model/index.js";
import {
  coreD,
  coreW,
  rearT,
  externalRuns,
  externalWall,
  groundFloor,
  mainHalfLanding,
  partT,
  studT,
} from "../shared.js";

// Walls stop at the clear ceiling. The first-floor slab sits on them, and its exposed edges are
// the floor structure between storeys, including the band at the facade.
export const wallH = groundFloor.ceilingHeight;
const breastT = mm(350); // chimney breasts and thickened masonry walls, per the owner
const bathLeftT = mm(225); // bathroom left wall, 9-inch brick per the owner

// ── Internal layout (plan faces) ─────────────────────────────────────────────
export const partitionX = mm(4650); //  front face of the living/bedroom partition; living room 4.2 m wide (owner)
export const hallWallY = mm(6400); //   right face of the hall/living wall; living room 5.8 m deep from the breast (owner)
export const bedroomWallY = mm(4080); // right face of the bedroom/bathroom wall; bedroom 3.48 m deep from the breast (owner, incl. stair surplus)
export const bathFrontX = mm(5690); //   front face of the lobby/bathroom wall; lobby 0.865 m wide (owner)
export const bathLeftY = mm(5855); //  right face of the bathroom's left wall; bathroom 1.6 m deep (owner)
export const spineY = mm(6990); //      right face of the wall between the stair flights; both flights 0.91 m wide (owner)
export const spineRearX = mm(8945); // keeps its traced overlap into the rear wall; the stairwell's rear edge
export const spineEndX = mm(8010); // where the flights turn; the half landing's front edge

// ── External walls (counter-clockwise, body on the left = inside) ────────────
// The party wall stops at the core's rear edge: the extension is split level, so its walls stop at
// the main half landing, which carries them on up (../extension.ts). They stop there on this floor
// until the basement half landing and the rear hall are planned.
const extH = sub(mainHalfLanding.elevation, groundFloor.elevation);
export const party = wall("wall-party", pt(coreW, coreD), externalRuns.party.end, {
  thickness: externalRuns.party.thickness,
  height: wallH,
  justification: externalRuns.party.justification,
});
export const partyExt = wall("wall-party-extension", externalRuns.party.start, pt(coreW, coreD), {
  thickness: externalRuns.party.thickness,
  height: extH,
  justification: externalRuns.party.justification,
});
export const end = externalWall("wall-end", externalRuns.end, wallH);
export const endIn = face(end, "north");
export const partyIn = face(party, "south");
export const front = externalWall("wall-front", externalRuns.front, wallH);
export const frontIn = face(front, "east");

const alcove = mm(700); // each side of the living room's chimney breast (owner)
export const livingBreast = { front: add(frontIn, alcove), rear: sub(partitionX, alcove) };

// Bathroom left wall first: the core's rear wall stops at its left face, level with the extension's right wall.
export const bathLeft = wall("wall-bathroom-left", pt(sub(coreW, rearT), bathLeftY), pt(bathFrontX, bathLeftY), {
  thickness: bathLeftT,
  height: wallH,
  justification: "right",
});
// The rear wall stops at the bathroom left wall's face, short of the canonical run's end.
export const rear = wall("wall-rear", externalRuns.rear.start, pt(coreW, face(bathLeft, "north")), {
  thickness: rearT,
  height: wallH,
  justification: "left",
});
export const rearIn = face(rear, "west");

export const extRear = externalWall("wall-extension-rear", externalRuns.extRear, extH);
export const extRight = externalWall("wall-extension-right", externalRuns.extRight, extH);

// Chimney breast in the living room and the thickened wall along the bedroom, both against the end wall.
export const breastLiving = wall("wall-breast-living", pt(livingBreast.front, endIn), pt(livingBreast.rear, endIn), {
  thickness: breastT,
  height: wallH,
  justification: "left",
});

// ── Internal walls ───────────────────────────────────────────────────────────
const inner = { thickness: partT, height: wallH };
const lobbyBathT = mm(135); // owner widths: bedroom 3.85 − lobby 0.865 − bathroom 2.85
export const livingBedroom = wall("wall-living-bedroom", pt(partitionX, endIn), pt(partitionX, hallWallY), {
  ...inner,
  justification: "right",
});
export const partitionRear = face(livingBedroom, "east");
// Runs over the partition's top so the corner is closed.
export const hallLiving = wall("wall-hall-living", pt(frontIn, hallWallY), pt(partitionRear, hallWallY), {
  ...inner,
  justification: "left",
});
export const breastBedroom = wall("wall-breast-bedroom", pt(partitionRear, endIn), pt(rearIn, endIn), {
  thickness: breastT,
  height: wallH,
  justification: "left",
});
export const bedroomBathroom = wall(
  "wall-bedroom-bathroom",
  pt(partitionRear, bedroomWallY),
  pt(rearIn, bedroomWallY),
  { ...inner, justification: "left" },
);
export const lobbyBathroom = wall(
  "wall-lobby-bathroom",
  pt(bathFrontX, face(bedroomBathroom, "north")),
  pt(bathFrontX, face(bathLeft, "north")),
  { thickness: lobbyBathT, height: wallH, justification: "right" },
);
// Front end 175 mm short of its traced position, to leave room by the lobby door. Rear end runs to
// its traced length (spineEastX); the half landing wraps around that end rather than cutting it
// short.
export const spine = wall("wall-stair-spine", pt(mm(5450), spineY), pt(spineRearX, spineY), {
  ...inner,
  justification: "left",
});
// Diagonal screen from the hall wall's corner towards the stair spine's front-left corner, holding
// the lobby door. Its lower end tucks into the hall wall; its centreline stops half a thickness
// inside the spine, so the hallway-side face meets the spine's corner and lines up with its face.
const screenStart = pt(partitionRear, face(hallLiving, "north"));
const screenCorner = pt(spine.start.x, face(spine, "north"));
const screenRun = Math.hypot(screenCorner.x - screenStart.x, screenCorner.y - screenStart.y);
const screenHalf = studT / 2;
const screenEnd = pt(
  add(screenCorner.x, mm(Math.round((screenHalf * (screenCorner.y - screenStart.y)) / screenRun))),
  sub(screenCorner.y, mm(Math.round((screenHalf * (screenCorner.x - screenStart.x)) / screenRun))),
);
const screenLength = Math.hypot(screenEnd.x - screenStart.x, screenEnd.y - screenStart.y);
const screenTuckX = mm(Math.round(((screenEnd.x - screenStart.x) * partT) / screenLength));
const screenTuckY = mm(Math.round(((screenEnd.y - screenStart.y) * partT) / screenLength));
export const lobbyScreen = wall(
  "wall-lobby-screen",
  pt(sub(screenStart.x, screenTuckX), sub(screenStart.y, screenTuckY)),
  screenEnd,
  { thickness: studT, height: wallH, justification: "centre" },
);

// The lobby-side face leaves the hall wall at its rear end and runs into the spine's front end. It
// is shorter than the centreline, so the lobby doorway must be centred on this face: on the
// centreline its far jamb would sit inside the spine.
const lobbyUnit = { x: (screenEnd.x - screenStart.x) / screenLength, y: (screenEnd.y - screenStart.y) / screenLength };
const alongLobbyScreen = (p: { x: number; y: number }) =>
  (p.x - lobbyScreen.start.x) * lobbyUnit.x + (p.y - lobbyScreen.start.y) * lobbyUnit.y;
const lobbyVisibleStart = alongLobbyScreen(faceCrossing(lobbyScreen, "right", "x", partitionRear));
const lobbyVisibleEnd = alongLobbyScreen(faceCrossing(lobbyScreen, "right", "x", spine.start.x));
export const lobbyScreenLobbyStart = mm(Math.round(lobbyVisibleStart));
export const lobbyScreenLobbyVisibleLength = mm(Math.round(lobbyVisibleEnd - lobbyVisibleStart));

export const walls = [
  party,
  partyExt,
  end,
  front,
  rear,
  extRear,
  extRight,
  breastLiving,
  breastBedroom,
  hallLiving,
  livingBedroom,
  bedroomBathroom,
  lobbyBathroom,
  bathLeft,
  spine,
  lobbyScreen,
];
