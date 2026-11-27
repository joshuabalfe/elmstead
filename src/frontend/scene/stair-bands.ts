/** The riser height the viewer's stair banding uses, apart from the engine so it can be tested. */
import type { BuildingModel } from "../../shared/schema/schema.js";

/**
 * One riser height, in metres, for the banding of every stair in a model. Fragments renders all
 * stairs under one material, so the shader cannot hold a riser per stair: take the largest, so the
 * stair with the most steps reads correctly and the others band on it too.
 *
 * A stair's riser is its rise over the risers of its flights and winders. This leaves out the extra
 * riser `stairLevels` adds for a top landing, as it always has; that is a separate matter.
 */
export function stairBandRiser(model: Pick<BuildingModel, "storeys"> | null): number {
  let riser = 0;
  for (const storey of model?.storeys ?? []) {
    for (const stair of storey.stairs ?? []) {
      const to = model!.storeys.find((s) => s.id === stair.toStoreyId);
      const total = stair.segments.reduce((n, seg) => (seg.kind === "landing" ? n : n + seg.risers), 0);
      if (to && total > 0) riser = Math.max(riser, (to.elevation - storey.elevation) / total / 1000);
    }
  }
  return riser;
}
