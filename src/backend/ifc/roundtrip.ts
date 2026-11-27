/**
 * Re-opens a written IFC with web-ifc and checks the geometry it produces, independently of the
 * writer: every element we wrote has a body, and every wall has lost exactly its openings' volume
 * (i.e. the IfcRelVoidsElement cuts really happen in a viewer).
 */
import * as WebIFC from "web-ifc";
import type { Issue } from "../checks/issue.js";
import { doorDivision } from "../../shared/geometry/door.js";
import { revealSplay } from "../../shared/geometry/opening.js";
import { area as polygonArea } from "../../shared/geometry/polygon.js";
import { railingGeometry } from "../../shared/geometry/railing.js";
import { flightProfileArea, stairLevels } from "../../shared/geometry/stair.js";
import { wallSideArea } from "../../shared/geometry/wall.js";
import { GLAZING_BAR_DEPTH, PANEL_THICKNESS, windowDivision, type Rect } from "../../shared/geometry/window.js";
import type { BuildingModel, Storey } from "../../shared/schema/schema.js";

/** Relative tolerance on volumes; triangulation of boxes is exact, so this only absorbs float noise. */
const VOLUME_TOLERANCE = 1e-3;

export interface ElementGeometry {
  tag: string;
  ifcType: string;
  /** mm³ */
  volume: number;
  triangles: number;
}

/** Signed volume of a closed triangle mesh (divergence theorem), in the units of `positions`. */
function meshVolume(positions: Float64Array | number[], indices: Uint32Array): number {
  let v = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i]! * 3;
    const b = indices[i + 1]! * 3;
    const c = indices[i + 2]! * 3;
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = [
      positions[a]!,
      positions[a + 1]!,
      positions[a + 2]!,
      positions[b]!,
      positions[b + 1]!,
      positions[b + 2]!,
      positions[c]!,
      positions[c + 1]!,
      positions[c + 2]!,
    ];
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return v / 6;
}

export async function ifcGeometry(ifc: Uint8Array): Promise<Map<string, ElementGeometry>> {
  const api = new WebIFC.IfcAPI();
  await api.Init();
  api.SetLogLevel(WebIFC.LogLevel.LOG_LEVEL_ERROR);
  const modelID = api.OpenModel(ifc);
  const out = new Map<string, ElementGeometry>();
  try {
    // applyLinearScalingFactor=false keeps the file's unit (mm).
    api.StreamAllMeshes(
      modelID,
      (mesh) => {
        const line = api.GetLine(modelID, mesh.expressID);
        const tag: string | undefined = line?.Tag?.value;
        if (!tag) return;
        let volume = 0;
        let triangles = 0;
        for (let i = 0; i < mesh.geometries.size(); i++) {
          const pg = mesh.geometries.get(i);
          const geom = api.GetGeometry(modelID, pg.geometryExpressID);
          const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
          const idx = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());
          const m = pg.flatTransformation;
          // Vertex layout is [x, y, z, nx, ny, nz]; apply the placement (column-major 4×4).
          const pos = new Float64Array((verts.length / 6) * 3);
          for (let j = 0, k = 0; j < verts.length; j += 6, k += 3) {
            const [x, y, z] = [verts[j]!, verts[j + 1]!, verts[j + 2]!];
            pos[k] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
            pos[k + 1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
            pos[k + 2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
          }
          volume += meshVolume(pos, idx);
          triangles += idx.length / 3;
          geom.delete();
        }
        out.set(tag, { tag, ifcType: api.GetNameFromTypeCode(line.type), volume: Math.abs(volume), triangles });
      },
      false,
    );
  } finally {
    api.CloseModel(modelID);
  }
  return out;
}

/** A volume the model says an IFC element should have, and what the element is, for messages. */
export interface ExpectedVolume {
  id: string;
  volume: number;
  what: string;
}

function wallVolumes(s: Storey): ExpectedVolume[] {
  return s.walls.map((w) => {
    // Each opening's plan area within the wall: a splayed reveal adds a triangle at each jamb.
    const cut = s.openings
      .filter((o) => o.wallId === w.id)
      .reduce((sum, o) => sum + (o.width + revealSplay(w, o) / 2) * w.thickness * o.height, 0);
    return { id: w.id, volume: wallSideArea(w) * w.thickness - cut, what: "wall (after opening cuts)" };
  });
}

const rectArea = (rs: readonly Rect[]): number => rs.reduce((a, r) => a + r.w * r.h, 0);

function openingVolumes(model: BuildingModel, s: Storey): ExpectedVolume[] {
  const doorDesigns = new Map((model.components?.doors ?? []).map((c) => [c.id, c]));
  const windowDesigns = new Map((model.components?.windows ?? []).map((c) => [c.id, c]));
  const out: ExpectedVolume[] = [];
  for (const o of s.openings) {
    if (o.kind === "door") {
      if (o.doorway) continue;
      const { leaf, frame } = doorDivision(o, o.componentId ? doorDesigns.get(o.componentId) : undefined);
      out.push({
        id: o.id,
        volume: leaf.w * leaf.h * PANEL_THICKNESS + rectArea(frame) * GLAZING_BAR_DEPTH,
        what: frame.length ? "door (frame and leaf)" : "door panel",
      });
      continue;
    }
    // Frame, panes and bars never overlap, so their volumes add up.
    const { panes, bars, frame } = windowDivision(o, o.componentId ? windowDesigns.get(o.componentId) : undefined);
    const solid = [...frame, ...bars];
    out.push({
      id: o.id,
      volume: rectArea(panes) * PANEL_THICKNESS + rectArea(solid) * GLAZING_BAR_DEPTH,
      what: solid.length ? "window (frame, panes and bars)" : "window panel",
    });
  }
  return out;
}

function stairVolumes(model: BuildingModel, s: Storey): ExpectedVolume[] {
  const out: ExpectedVolume[] = [];
  for (const stair of s.stairs ?? []) {
    const to = model.storeys.find((x) => x.id === stair.toStoreyId);
    if (!to) continue; // a missing target is a check error, which gates the build
    const levels = stairLevels(stair, to.elevation - s.elevation);
    for (const l of levels.segments) {
      if (l.kind === "flight")
        out.push({
          id: l.segment.id,
          volume: flightProfileArea(l.segment, l.going, levels.riser) * l.segment.width,
          what: "stair flight",
        });
      else
        out.push({
          id: l.segment.id,
          volume: polygonArea(l.segment.outline) * l.segment.thickness,
          what: "stair landing",
        });
    }
    // The IfcStair container is deliberately left out: it has no body, so its geometry is counted
    // once, through the flights and landings above.
  }
  return out;
}

/** Every element volume the model implies, for comparison with what web-ifc builds from the IFC. */
export function expectedVolumes(model: BuildingModel): ExpectedVolume[] {
  return model.storeys.flatMap((s) => [
    ...wallVolumes(s),
    ...s.slabs.map((sl) => ({ id: sl.id, volume: polygonArea(sl.outline) * sl.thickness, what: "slab" })),
    ...openingVolumes(model, s),
    ...stairVolumes(model, s),
    ...(s.railings ?? []).map((r) => ({ id: r.id, volume: railingGeometry(r).volume, what: "railing" })),
  ]);
}

/** Expected volumes from the model vs what web-ifc actually builds from the IFC. */
export async function roundTripChecks(model: BuildingModel, ifc: Uint8Array): Promise<Issue[]> {
  const geom = await ifcGeometry(ifc);
  const issues: Issue[] = [];
  for (const { id, volume: expected, what } of expectedVolumes(model)) {
    const g = geom.get(id);
    if (!g) {
      issues.push({ level: "ERROR", id, message: `round-trip: web-ifc produced no geometry for this ${what}` });
      continue;
    }
    if (!Number.isFinite(g.volume) || expected <= 0) {
      issues.push({
        level: "ERROR",
        id,
        message: `round-trip: ${what} volume is not a finite positive number (got ${g.volume}, expected ${expected})`,
      });
      continue;
    }
    const rel = Math.abs(g.volume - expected) / expected;
    if (rel > VOLUME_TOLERANCE) {
      issues.push({
        level: "ERROR",
        id,
        message: `round-trip: ${what} volume is ${(g.volume / 1e9).toFixed(4)} m³ in IFC, expected ${(expected / 1e9).toFixed(4)} m³ from the model`,
      });
    }
  }
  return issues;
}
