import type { BuildingModel, Door, DoorComponent, Railing, Room, Site, Slab, Stair, StairFlight, StairLanding, Storey, Wall, Window, WindowComponent } from "../schema/schema.js";

/** A node on a storey, with that storey's id. */
type OnStorey<K extends string, E> = { kind: K; element: E; storey: string };

/** Every id-bearing node, tagged with its kind; the kinds that live on a storey carry its id. */
export type IdNode =
  | { kind: "project"; element: BuildingModel["project"] }
  | { kind: "site"; element: Site }
  | { kind: "building"; element: BuildingModel["building"] }
  | { kind: "door component"; element: DoorComponent }
  | { kind: "window component"; element: WindowComponent }
  | OnStorey<"storey", Storey>
  | OnStorey<"wall", Wall>
  | OnStorey<"door", Door>
  | OnStorey<"window", Window>
  | OnStorey<"slab", Slab>
  | OnStorey<"room", Room>
  | OnStorey<"stair", Stair>
  | OnStorey<"stair flight", StairFlight>
  | OnStorey<"stair landing", StairLanding>
  | OnStorey<"railing", Railing>;

/** The kinds of node that live on a storey. */
export type StoreyKind = Extract<IdNode, { storey: string }>["kind"];

/** Every id-bearing node in model order, components last. Ids are not checked for uniqueness here. */
export function idNodes(model: BuildingModel): IdNode[] {
  const nodes: IdNode[] = [
    { kind: "project", element: model.project },
    { kind: "site", element: model.site },
    { kind: "building", element: model.building },
  ];
  for (const s of model.storeys) {
    const storey = s.id;
    nodes.push({ kind: "storey", element: s, storey });
    for (const w of s.walls) nodes.push({ kind: "wall", element: w, storey });
    for (const o of s.openings) nodes.push(o.kind === "door" ? { kind: "door", element: o, storey } : { kind: "window", element: o, storey });
    for (const sl of s.slabs) nodes.push({ kind: "slab", element: sl, storey });
    for (const r of s.rooms) nodes.push({ kind: "room", element: r, storey });
    for (const st of s.stairs ?? []) {
      nodes.push({ kind: "stair", element: st, storey });
      for (const seg of st.segments) nodes.push(seg.kind === "flight" ? { kind: "stair flight", element: seg, storey } : { kind: "stair landing", element: seg, storey });
    }
    for (const r of s.railings ?? []) nodes.push({ kind: "railing", element: r, storey });
  }
  for (const c of model.components?.doors ?? []) nodes.push({ kind: "door component", element: c });
  for (const c of model.components?.windows ?? []) nodes.push({ kind: "window component", element: c });
  return nodes;
}
