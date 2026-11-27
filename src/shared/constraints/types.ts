import type { Vec } from "../geometry/vec.js";

/** A constraint that measured, with the plan geometry the viewer draws. */
export interface ResolvedConstraint {
  id: string;
  /** The group's scope: its storey or room id. */
  scope: string;
  storey: string;
  /** Model plan coordinates in mm. */
  from: Vec;
  to: Vec;
  /** The plan span the measurement covers, for drawing. */
  span: { from: Vec; to: Vec };
  /** The required distance in mm, not the measured one. */
  distance: number;
}
