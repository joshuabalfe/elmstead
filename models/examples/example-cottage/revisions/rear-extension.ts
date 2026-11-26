/**
 * Example cottage, rear extension: an illustrative proposal, to show how a revision is written.
 *
 *   +--------------+                       north
 *   |   lean-to    |
 *   |              |
 *   +----+ D +-----+---------+--------+
 *   |              |  hall   |  bath  |
 *   | living       |         +--------+
 *   | kitchen      |         |  bed   |
 *   +---[ wider ]--+---------+--------+   south
 *
 *   - the living room and kitchen are knocked through into one room (wall-living-kitchen goes);
 *   - the kitchen window is taken out, and a doorway (D) through wall-north opens into a lean-to;
 *   - the living-room window is widened from 1.2 m to 1.8 m, about the same centre.
 *
 * rear-extension.constraints.ts says which of the cottage's measurements this changes.
 */
import { addTo, centredOn, doorway, face, mm, pt, remove, replace, revise, sub, wall, type Room, type Window } from "../../../../src/model/index.js";
import base from "../index.js";

const ground = base.storeys[0]!;
const wallOf = (id: string) => ground.walls.find((w) => w.id === id)!;
const north = wallOf("wall-north");
const west = wallOf("wall-west");
const hallWest = wallOf("wall-hall-west");

// ── Knock-through: one room from the front wall to the back, keeping the living room's id ─────
const living = ground.rooms.find((r) => r.id === "room-living")!;
const westIn = face(west, "east");
const eastIn = face(hallWest, "west");
const livingKitchen: Room = {
  ...living,
  name: "Living kitchen",
  outline: [pt(westIn, living.outline[0]!.y), pt(eastIn, living.outline[0]!.y), pt(eastIn, face(north, "south")), pt(westIn, face(north, "south"))],
};

// ── Lean-to: three walls whose outer faces are a rectangle off the back wall ────────────────
const leanToWidth = mm(3600);
const leanToDepth = mm(2400);
const leanToT = mm(200);
const back = face(north, "north"); // the cottage's outside north face, where the lean-to starts
const leanTo = { thickness: leanToT, height: mm(2400), justification: "left" as const };
const x1 = leanToWidth;
const y1 = mm(back + leanToDepth);
// Counter-clockwise like rectWalls, body to the left (inside); east and west butt under the north wall.
const leanToEast = wall("wall-lean-to-east", pt(x1, back), pt(x1, sub(y1, leanToT)), leanTo);
const leanToNorth = wall("wall-lean-to-north", pt(x1, y1), pt(mm(0), y1), leanTo);
const leanToWest = wall("wall-lean-to-west", pt(mm(0), sub(y1, leanToT)), pt(mm(0), back), leanTo);
const leanToRoom: Room = {
  id: "room-lean-to",
  name: "Lean-to",
  outline: [pt(face(leanToWest, "east"), back), pt(face(leanToEast, "west"), back), pt(face(leanToEast, "west"), face(leanToNorth, "south")), pt(face(leanToWest, "east"), face(leanToNorth, "south"))],
};
const leanToMid = mm(Math.round(leanToWidth / 2));

// ── Wider front window, about its old centre ─────────────────────────────────────────────────
const window = ground.openings.find((o) => o.id === "window-living") as Window;
const widerWindow: Window = { ...window, width: mm(1800), offsetAlongWall: mm(window.offsetAlongWall - 300) };

export default revise(base, [
  remove("wall-living-kitchen", "room-kitchen", "window-kitchen"),
  replace(livingKitchen, widerWindow),
  addTo("storey-ground", {
    walls: [leanToEast, leanToNorth, leanToWest],
    openings: [doorway("doorway-lean-to", north, centredOn(north, leanToMid, mm(900)), { width: mm(900), height: mm(2100) })],
    slabs: [{ id: "slab-lean-to", name: "Lean-to slab", outline: [pt(mm(0), back), pt(x1, back), pt(x1, y1), pt(mm(0), y1)], thickness: mm(150), elevationOffset: mm(0) }],
    rooms: [leanToRoom],
  }),
]);
