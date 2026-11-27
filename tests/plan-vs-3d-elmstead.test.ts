/**
 * Elmstead's Top view against its plan, storey by storey, and that the comparison catches a room
 * outline run to a wall's centreline. See plan-vs-3d.test.ts.
 */
import { describe, expect, it } from "vitest";
import elmstead from "../models/elmstead/index.js";
import { comparePlanTo3d } from "./support/plan-vs-3d.js";
import { compareEveryStorey, planPixels } from "./support/plan-compare.js";
import { model, publish, topView, useViewer } from "./support/viewer-page.js";

useViewer();

describe("3D Top view against the plan", () => {
  compareEveryStorey([["models/elmstead", elmstead]]);

  it("catches a room outline that runs to a wall's centreline (the lobby door gap shows room fill on the plan only)", async () => {
    // Elmstead as first traced: the hallway and lobby both ran to the diagonal lobby screen's
    // centreline, so on the plan the lobby door's gap showed room fill, in 3D a white gap.
    const m = structuredClone(await model("models/elmstead"));
    const storey = m.storeys.find((s) => s.id === "storey-ground")!;
    const screen = storey.walls.find((w) => w.id === "wall-lobby-screen")!;
    const hallway = storey.rooms.find((r) => r.id === "room-hallway")!;
    const lobby = storey.rooms.find((r) => r.id === "room-lobby")!;
    expect([hallway.outline.length, lobby.outline.length]).toEqual([6, 5]);
    hallway.outline.splice(1, 2, screen.start, screen.end);
    lobby.outline.splice(3, 2, screen.end, screen.start);
    await publish("test-elmstead-centreline", m);
    // Finer tiles than the default: the defect is a door gap, a band only as deep as the wall, which
    // a 500 mm tile dilutes below the comparator's 25%-comparable threshold.
    const r = comparePlanTo3d(planPixels(m, storey), await topView("test-elmstead-centreline", "storey-ground"), {
      tile: 250,
      step: 125,
    });
    expect(r.badTiles.length).toBeGreaterThan(0);
    // Some tile covers the screen, whose wall runs from (4.691, 6.462) to (5.484, 7.129) m.
    const over = r.badTiles.find((t) => t.x[0] < 5.484 && t.x[1] > 4.691 && t.y[0] < 7.165 && t.y[1] > 6.462);
    expect(over, `screen tiles among ${r.badTiles.length}: ${JSON.stringify(r.badTiles.slice(0, 4))}`).toBeDefined();
  }, 120_000);
});
