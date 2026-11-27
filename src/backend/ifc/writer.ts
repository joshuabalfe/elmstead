/**
 * Building JSON → IFC4, via web-ifc. Translation only: every number here comes from the model; the
 * only things decided here are how our concepts map onto IFC entities (documented inline).
 *
 * Coordinates: IFC length unit is the millimetre, so model values are written as-is. Plan x/y map to
 * IFC X/Y, Z is up. Every IfcRoot gets a GlobalId from ifcGuid(key); see guid.ts for the key scheme.
 */
import * as WebIFC from "web-ifc";
import { doorDivision } from "../../shared/geometry/door.js";
import { isSplayed, openingProfile } from "../../shared/geometry/opening.js";
import { POST_SIZE, RAIL_DEPTH, RAIL_WIDTH, railingGeometry } from "../../shared/geometry/railing.js";
import {
  flightDirection,
  flightProfile,
  flightRun,
  stairLevels,
  turnBetween,
  type FlightLevel,
} from "../../shared/geometry/stair.js";
import { v, type Vec } from "../../shared/geometry/vec.js";
import { faceOffsets, wallDirection, wallHeight, wallLength, wallSideProfile } from "../../shared/geometry/wall.js";
import { GLAZING_BAR_DEPTH, PANEL_THICKNESS, windowDivision, type Rect } from "../../shared/geometry/window.js";
import type {
  BuildingModel,
  Door,
  DoorComponent,
  Opening,
  Railing,
  Room,
  Slab,
  Stair,
  StairFlight,
  StairLanding,
  Storey,
  Wall,
  Window,
  WindowComponent,
} from "../../shared/schema/schema.js";
import { ifcGuid } from "./guid.js";
import { STYLES, type StyleName } from "../../shared/ifc/styles.js";

const { IFC4 } = WebIFC;
type Line = WebIFC.IfcLineObject;

/** Opening solids extend this far past each wall face so the boolean cut is clean. */
const OPENING_CLEARANCE = 10;
/** web-ifc stamps the current time into FILE_NAME; we fix it so rebuilding is byte-identical. */
const FIXED_TIMESTAMP = "1970-01-01T00:00:00";
/** FILE_NAME.authorization must be a STRING; web-ifc writes an empty one as $ (null). */
const AUTHORIZATION = "none";

/**
 * IFC4 partitions its window types into one, two or three panels; larger grids are USERDEFINED.
 * The enum names describe the arrangement of the panels: VERTICAL is side by side, HORIZONTAL is
 * stacked (matching TRIPLE_PANEL_TOP's "two panels vertically and the third horizontally at the top").
 */
function windowPartitioning(design?: Pick<WindowComponent, "glazing">): { value: any; userDefined: string | null } {
  const columns = design?.glazing?.columns.length ?? 1;
  const rows = design?.glazing?.rows.length ?? 1;
  if (columns === 1 && rows === 1) return { value: IFC4.IfcWindowTypePartitioningEnum.SINGLE_PANEL, userDefined: null };
  if (rows === 1 && columns === 2)
    return { value: IFC4.IfcWindowTypePartitioningEnum.DOUBLE_PANEL_VERTICAL, userDefined: null };
  if (columns === 1 && rows === 2)
    return { value: IFC4.IfcWindowTypePartitioningEnum.DOUBLE_PANEL_HORIZONTAL, userDefined: null };
  if (rows === 1 && columns === 3)
    return { value: IFC4.IfcWindowTypePartitioningEnum.TRIPLE_PANEL_VERTICAL, userDefined: null };
  if (columns === 1 && rows === 3)
    return { value: IFC4.IfcWindowTypePartitioningEnum.TRIPLE_PANEL_HORIZONTAL, userDefined: null };
  return { value: IFC4.IfcWindowTypePartitioningEnum.USERDEFINED, userDefined: `${columns}x${rows} grid` };
}

export interface WriteOptions {
  /** Used for FILE_NAME in the header. */
  fileName: string;
}

/**
 * An IfcStair's PredefinedType, from the turning angle between its flights. IFC4 has no ShapeType on
 * IfcStair; the IFC2x3 name for this is the enum's, and the enum values are the same in both.
 */
function stairType(flights: readonly StairFlight[]) {
  if (flights.length === 1) return IFC4.IfcStairTypeEnum.STRAIGHT_RUN_STAIR;
  if (flights.length === 2) {
    const turn = turnBetween(flights[0]!, flights[1]!);
    if (Math.abs(turn) < 1e-6) return IFC4.IfcStairTypeEnum.TWO_STRAIGHT_RUN_STAIR;
    if (Math.abs(turn - 90) < 1e-6) return IFC4.IfcStairTypeEnum.QUARTER_TURN_STAIR;
    if (Math.abs(turn - 180) < 1e-6) return IFC4.IfcStairTypeEnum.HALF_TURN_STAIR;
  }
  return IFC4.IfcStairTypeEnum.NOTDEFINED;
}

let apiPromise: Promise<WebIFC.IfcAPI> | undefined;
async function ifcApi(): Promise<WebIFC.IfcAPI> {
  apiPromise ??= (async () => {
    const api = new WebIFC.IfcAPI();
    await api.Init();
    api.SetLogLevel(WebIFC.LogLevel.LOG_LEVEL_ERROR);
    return api;
  })();
  return apiPromise;
}

export async function writeIfc(model: BuildingModel, opts: WriteOptions): Promise<Uint8Array> {
  const api = await ifcApi();
  const id = api.CreateModel({
    schema: WebIFC.Schemas.IFC4,
    name: opts.fileName,
    description: ["ViewDefinition [DesignTransferView]"],
    authors: [""],
    organizations: [""],
  });
  try {
    new Writer(api, id).building(model);
    return fixHeader(api.SaveModel(id));
  } finally {
    api.CloseModel(id);
  }
}

/** Rewrites the two FILE_NAME fields web-ifc gives us no control over; fails loudly if the format changes. */
function fixHeader(bytes: Uint8Array): Uint8Array {
  const text = new TextDecoder().decode(bytes);
  const re = /FILE_NAME\(('[^']*'),'[^']*',(.*),\$\);/;
  if (!re.test(text)) throw new Error("unexpected FILE_NAME header from web-ifc; update fixHeader()");
  return new TextEncoder().encode(text.replace(re, `FILE_NAME($1,'${FIXED_TIMESTAMP}',$2,'${AUTHORIZATION}');`));
}

// ── Value helpers ─────────────────────────────────────────────────────────────

const label = (s: string) => new IFC4.IfcLabel(s);
const ident = (s: string) => new IFC4.IfcIdentifier(s);
const guid = (key: string) => new IFC4.IfcGloballyUniqueId(ifcGuid(key));
const len = (n: number) => new IFC4.IfcLengthMeasure(n);
const posLen = (n: number) => new IFC4.IfcPositiveLengthMeasure(n);
const real = (n: number) => new IFC4.IfcReal(n);

class Writer {
  // Shared geometry, written once and referenced by every placement.
  private readonly origin3 = new IFC4.IfcCartesianPoint([len(0), len(0), len(0)]);
  private readonly zAxis = new IFC4.IfcDirection([real(0), real(0), real(1)]);
  private bodyCtx!: InstanceType<typeof IFC4.IfcGeometricRepresentationSubContext>;
  /** Doors and windows written so far, by the componentId they are an instance of. */
  private readonly instances = new Map<string, InstanceType<typeof IFC4.IfcObject>[]>();
  /** Door components (their frames), by id. */
  private doorDesigns = new Map<string, DoorComponent>();
  /** Window components (their frames and glazing bars), by id. */
  private windowDesigns = new Map<string, WindowComponent>();
  private axisCtx!: InstanceType<typeof IFC4.IfcGeometricRepresentationSubContext>;
  private footprintCtx!: InstanceType<typeof IFC4.IfcGeometricRepresentationSubContext>;

  constructor(
    private readonly api: WebIFC.IfcAPI,
    private readonly modelID: number,
  ) {}

  private write<T extends Line>(line: T): T {
    this.api.WriteLine(this.modelID, line);
    return line;
  }

  private pt3(x: number, y: number, z: number) {
    return new IFC4.IfcCartesianPoint([len(x), len(y), len(z)]);
  }

  private pt2(x: number, y: number) {
    return new IFC4.IfcCartesianPoint([len(x), len(y)]);
  }

  /** Local placement at (x, y, z) with its X axis along (dx, dy) in the parent's XY plane. */
  private placement(
    parent: InstanceType<typeof IFC4.IfcLocalPlacement> | null,
    x: number,
    y: number,
    z: number,
    dx = 1,
    dy = 0,
  ) {
    const location = x === 0 && y === 0 && z === 0 ? this.origin3 : this.pt3(x, y, z);
    const refDirection = dx === 1 && dy === 0 ? null : new IFC4.IfcDirection([real(dx), real(dy), real(0)]);
    const axis = new IFC4.IfcAxis2Placement3D(location, refDirection ? this.zAxis : null, refDirection);
    return new IFC4.IfcLocalPlacement(parent, axis);
  }

  private closedPolyline(points: readonly Vec[]) {
    const pts = points.map((p) => this.pt2(p.x, p.y));
    return new IFC4.IfcPolyline([...pts, pts[0]!]);
  }

  private readonly styles = new Map<StyleName, InstanceType<typeof IFC4.IfcSurfaceStyle>>();

  private surfaceStyle(name: StyleName) {
    let style = this.styles.get(name);
    if (!style) {
      const { rgb, transparency } = STYLES[name];
      const ratio = (n: number) => new IFC4.IfcNormalisedRatioMeasure(n);
      const colour = new IFC4.IfcColourRgb(null, ratio(rgb[0]), ratio(rgb[1]), ratio(rgb[2]));
      style = new IFC4.IfcSurfaceStyle(label(name), IFC4.IfcSurfaceSide.BOTH, [
        new IFC4.IfcSurfaceStyleShading(colour, ratio(transparency)),
      ]);
      this.styles.set(name, style);
    }
    return style;
  }

  /** Extrusion of a profile straight up by `depth`, as a Body/SweptSolid shape, optionally coloured. */
  private body(profile: InstanceType<typeof IFC4.IfcProfileDef>, depth: number, style?: StyleName) {
    const solid = new IFC4.IfcExtrudedAreaSolid(profile, null, this.zAxis, posLen(depth));
    if (style) this.write(new IFC4.IfcStyledItem(solid, [this.surfaceStyle(style)], null));
    return new IFC4.IfcShapeRepresentation(this.bodyCtx, label("Body"), label("SweptSolid"), [solid]);
  }

  private rectangle(cx: number, cy: number, xDim: number, yDim: number) {
    return new IFC4.IfcRectangleProfileDef(
      IFC4.IfcProfileTypeEnum.AREA,
      null,
      new IFC4.IfcAxis2Placement2D(this.pt2(cx, cy), null),
      posLen(xDim),
      posLen(yDim),
    );
  }

  // ── Spatial structure ─────────────────────────────────────────────────────

  building(model: BuildingModel): void {
    const units = new IFC4.IfcUnitAssignment([
      new IFC4.IfcSIUnit(IFC4.IfcUnitEnum.LENGTHUNIT, IFC4.IfcSIPrefix.MILLI, IFC4.IfcSIUnitName.METRE),
      new IFC4.IfcSIUnit(IFC4.IfcUnitEnum.AREAUNIT, null, IFC4.IfcSIUnitName.SQUARE_METRE),
      new IFC4.IfcSIUnit(IFC4.IfcUnitEnum.VOLUMEUNIT, null, IFC4.IfcSIUnitName.CUBIC_METRE),
      new IFC4.IfcSIUnit(IFC4.IfcUnitEnum.PLANEANGLEUNIT, null, IFC4.IfcSIUnitName.RADIAN),
    ]);

    // northAngle is degrees counter-clockwise from plan +y; TrueNorth is that direction as a vector.
    const north = ((model.site.northAngle ?? 0) * Math.PI) / 180;
    const trueNorth =
      north === 0 ? null : new IFC4.IfcDirection([real(round9(-Math.sin(north))), real(round9(Math.cos(north)))]);
    const context = new IFC4.IfcGeometricRepresentationContext(
      null,
      label("Model"),
      new IFC4.IfcDimensionCount(3),
      real(1e-5),
      new IFC4.IfcAxis2Placement3D(this.origin3, null, null),
      trueNorth,
    );
    const sub = (name: string, view: InstanceType<typeof IFC4.IfcGeometricProjectionEnum>) =>
      new IFC4.IfcGeometricRepresentationSubContext(label(name), label("Model"), context, null, view, null);
    this.bodyCtx = sub("Body", IFC4.IfcGeometricProjectionEnum.MODEL_VIEW);
    this.axisCtx = sub("Axis", IFC4.IfcGeometricProjectionEnum.GRAPH_VIEW);
    this.footprintCtx = sub("FootPrint", IFC4.IfcGeometricProjectionEnum.PLAN_VIEW);

    const project = this.write(
      new IFC4.IfcProject(
        guid(model.project.id),
        null,
        label(model.project.name),
        null,
        null,
        null,
        null,
        [context],
        units,
      ),
    );
    // Sub-contexts are only reachable by inverse, so write them explicitly.
    for (const c of [this.bodyCtx, this.axisCtx, this.footprintCtx]) this.write(c);

    const sitePlacement = this.placement(null, 0, 0, 0);
    const site = this.write(
      new IFC4.IfcSite(
        guid(model.site.id),
        null,
        label(model.site.name),
        null,
        null,
        sitePlacement,
        null,
        null,
        IFC4.IfcElementCompositionEnum.ELEMENT,
        null,
        null,
        null,
        null,
        null,
      ),
    );
    const buildingPlacement = this.placement(sitePlacement, 0, 0, 0);
    const building = this.write(
      new IFC4.IfcBuilding(
        guid(model.building.id),
        null,
        label(model.building.name),
        null,
        null,
        buildingPlacement,
        null,
        null,
        IFC4.IfcElementCompositionEnum.ELEMENT,
        null,
        null,
        null,
      ),
    );

    this.write(new IFC4.IfcRelAggregates(guid(`${model.project.id}#aggregates`), null, null, null, project, [site]));
    this.write(new IFC4.IfcRelAggregates(guid(`${model.site.id}#aggregates`), null, null, null, site, [building]));

    this.doorDesigns = new Map((model.components?.doors ?? []).map((c) => [c.id, c]));
    this.windowDesigns = new Map((model.components?.windows ?? []).map((c) => [c.id, c]));
    const elevations = new Map(model.storeys.map((s) => [s.id, s.elevation]));
    const storeys = model.storeys.map((s) => this.storey(s, buildingPlacement, elevations));
    this.write(new IFC4.IfcRelAggregates(guid(`${model.building.id}#aggregates`), null, null, null, building, storeys));
    this.components(model, project);
  }

  private storey(s: Storey, parent: InstanceType<typeof IFC4.IfcLocalPlacement>, elevations: Map<string, number>) {
    const placement = this.placement(parent, 0, 0, s.elevation);
    const storey = this.write(
      new IFC4.IfcBuildingStorey(
        guid(s.id),
        null,
        label(s.name),
        null,
        null,
        placement,
        null,
        null,
        IFC4.IfcElementCompositionEnum.ELEMENT,
        len(s.elevation),
      ),
    );

    const contained: InstanceType<typeof IFC4.IfcProduct>[] = [];
    const written = new Map<
      string,
      { wall: Wall; entity: InstanceType<typeof IFC4.IfcWall>; placement: InstanceType<typeof IFC4.IfcLocalPlacement> }
    >();
    for (const w of s.walls) {
      const { wall, placement: wp } = this.wall(w, placement);
      written.set(w.id, { wall: w, entity: wall, placement: wp });
      contained.push(wall);
    }
    for (const o of s.openings) {
      const host = written.get(o.wallId);
      if (!host) throw new Error(`${o.id}: wallId "${o.wallId}" is not a wall on ${s.id}`);
      const filling = this.opening(o, host.wall, host.placement, host.entity);
      if (filling) contained.push(filling);
    }
    for (const slab of s.slabs) contained.push(this.slab(slab, placement));
    for (const stair of s.stairs ?? []) {
      const to = elevations.get(stair.toStoreyId);
      if (to === undefined)
        throw new Error(`${stair.id}: toStoreyId "${stair.toStoreyId}" is not a storey in the model`);
      contained.push(this.stair(stair, placement, to - s.elevation));
    }
    for (const railing of s.railings ?? []) contained.push(this.railing(railing, placement));

    if (contained.length) {
      this.write(
        new IFC4.IfcRelContainedInSpatialStructure(guid(`${s.id}#contains`), null, null, null, contained, storey),
      );
    }
    if (s.rooms.length) {
      const spaces = s.rooms.map((r) => this.space(r, placement));
      this.write(new IFC4.IfcRelAggregates(guid(`${s.id}#spaces`), null, null, null, storey, spaces));
    }
    return storey;
  }

  // ── Elements ──────────────────────────────────────────────────────────────

  /** Wall placed at its start point with local X along the wall; body is a rectangle swept up. */
  private wall(w: Wall, parent: InstanceType<typeof IFC4.IfcLocalPlacement>) {
    const L = wallLength(w);
    if (L === 0) throw new Error(`${w.id}: zero-length wall cannot be written to IFC`);
    const d = wallDirection(w);
    const placement = this.placement(parent, w.start.x, w.start.y, 0, round9(d.x), round9(d.y));
    const { left, right } = faceOffsets(w);
    const axis = new IFC4.IfcShapeRepresentation(this.axisCtx, label("Axis"), label("Curve2D"), [
      new IFC4.IfcPolyline([this.pt2(0, 0), this.pt2(L, 0)]),
    ]);
    const body = w.profile
      ? this.pitchedWallBody(w, left)
      : this.body(this.rectangle(L / 2, (left + right) / 2, L, w.thickness), wallHeight(w), "wall");
    const wall = this.write(
      new IFC4.IfcWall(
        guid(w.id),
        null,
        label(w.name ?? w.id),
        null,
        null,
        placement,
        new IFC4.IfcProductDefinitionShape(null, null, [axis, body]),
        ident(w.id),
        IFC4.IfcWallTypeEnum.NOTDEFINED,
      ),
    );
    return { wall, placement };
  }

  /**
   * A pitched wall's body: its side elevation extruded across the thickness. The solid carries its
   * own rotated position (X along the wall, Y up, Z across to the right) so the wall's product
   * placement stays in plan axes and its openings keep working. Extruding from the left face by the
   * thickness spans the justification's [right, left] offsets.
   */
  private pitchedWallBody(w: Wall, left: number) {
    const profile = new IFC4.IfcArbitraryClosedProfileDef(
      IFC4.IfcProfileTypeEnum.AREA,
      null,
      this.closedPolyline(wallSideProfile(w).map((p) => v(round9(p.x), round9(p.y)))),
    );
    const position = new IFC4.IfcAxis2Placement3D(
      this.pt3(0, round9(left), 0),
      new IFC4.IfcDirection([real(0), real(-1), real(0)]),
      new IFC4.IfcDirection([real(1), real(0), real(0)]),
    );
    const solid = new IFC4.IfcExtrudedAreaSolid(profile, position, this.zAxis, posLen(w.thickness));
    this.write(new IFC4.IfcStyledItem(solid, [this.surfaceStyle("wall")], null));
    return new IFC4.IfcShapeRepresentation(this.bodyCtx, label("Body"), label("SweptSolid"), [solid]);
  }

  /**
   * An opening becomes IfcOpeningElement (voids the wall) + IfcDoor/IfcWindow (fills the opening).
   * The opening is placed in wall coordinates at (offsetAlongWall, 0, sillHeight). A box, or for a
   * window with a reveal its splayed plan outline (src/geometry/opening.ts) extruded up its height.
   */
  private opening(
    o: Opening,
    w: Wall,
    wallPlacement: InstanceType<typeof IFC4.IfcLocalPlacement>,
    wallEntity: InstanceType<typeof IFC4.IfcElement>,
  ): InstanceType<typeof IFC4.IfcDoor> | InstanceType<typeof IFC4.IfcWindow> | undefined {
    const { left, right } = faceOffsets(w);
    const mid = (left + right) / 2;
    const placement = this.placement(wallPlacement, o.offsetAlongWall, 0, o.sillHeight);
    const profile = isSplayed(o)
      ? new IFC4.IfcArbitraryClosedProfileDef(
          IFC4.IfcProfileTypeEnum.AREA,
          null,
          this.closedPolyline(
            openingProfile(w, o, OPENING_CLEARANCE).map((p) => ({
              x: round9(p.x - o.offsetAlongWall),
              y: round9(p.y),
            })),
          ),
        )
      : this.rectangle(o.width / 2, mid, o.width, w.thickness + 2 * OPENING_CLEARANCE);
    const body = this.body(profile, o.height);
    const doorway = o.kind === "door" && o.doorway === true;
    const opening = this.write(
      new IFC4.IfcOpeningElement(
        doorway ? guid(o.id) : guid(`${o.id}#opening`),
        null,
        doorway ? label(o.name ?? o.id) : label(`${o.id} opening`),
        null,
        null,
        placement,
        new IFC4.IfcProductDefinitionShape(null, null, [body]),
        doorway ? ident(o.id) : null,
        IFC4.IfcOpeningElementTypeEnum.OPENING,
      ),
    );
    this.write(new IFC4.IfcRelVoidsElement(guid(`${o.id}#voids`), null, null, null, wallEntity, opening));
    if (doorway) return undefined;
    const filling = o.kind === "door" ? this.door(o, mid, placement) : this.window(o, mid, placement);
    if (o.componentId) this.instances.set(o.componentId, [...(this.instances.get(o.componentId) ?? []), filling]);
    this.write(new IFC4.IfcRelFillsElement(guid(`${o.id}#fills`), null, null, null, opening, filling));
    return filling;
  }

  /**
   * IFC4 defines door handing looking along the door's local +Y (the opening direction): hinges on
   * the left are SINGLE_SWING_LEFT. We place the door with +Y pointing to the side it swings to.
   * The leaf fills the opening unless its component has a frame: that adds jambs and a head, and
   * the leaf shrinks to what is left. Frame boxes stand proud of the leaf like window frames.
   */
  private door(d: Door, mid: number, openingPlacement: InstanceType<typeof IFC4.IfcLocalPlacement>) {
    const swing = d.swing ?? { hinge: "start", side: "left" };
    const opensLeft = swing.side === "left"; // wall-local +Y is the wall's left
    const placement = this.placement(openingPlacement, d.width / 2, mid, 0, opensLeft ? 1 : -1, 0);
    const hingeOnDoorLeft = (swing.hinge === "start") === opensLeft;
    const design = d.componentId ? this.doorDesigns.get(d.componentId) : undefined;
    const { leaf, frame } = doorDivision(d, design);
    // Door-local X runs along the wall from the opening's centre; the rects are from its left edge.
    const piece = (r: Rect, depth: number, style: StyleName) => {
      const profile = this.rectangle(r.x + r.w / 2 - d.width / 2, 0, r.w, depth);
      const at = r.z === 0 ? null : new IFC4.IfcAxis2Placement3D(this.pt3(0, 0, r.z), null, null);
      const solid = new IFC4.IfcExtrudedAreaSolid(profile, at, this.zAxis, posLen(r.h));
      this.write(new IFC4.IfcStyledItem(solid, [this.surfaceStyle(style)], null));
      return solid;
    };
    const items = [piece(leaf, PANEL_THICKNESS, "door"), ...frame.map((f) => piece(f, GLAZING_BAR_DEPTH, "frame"))];
    const body = new IFC4.IfcShapeRepresentation(this.bodyCtx, label("Body"), label("SweptSolid"), items);
    return this.write(
      new IFC4.IfcDoor(
        guid(d.id),
        null,
        label(d.name ?? d.id),
        null,
        null,
        placement,
        new IFC4.IfcProductDefinitionShape(null, null, [body]),
        ident(d.id),
        posLen(d.height),
        posLen(d.width),
        IFC4.IfcDoorTypeEnum.DOOR,
        hingeOnDoorLeft
          ? IFC4.IfcDoorTypeOperationEnum.SINGLE_SWING_LEFT
          : IFC4.IfcDoorTypeOperationEnum.SINGLE_SWING_RIGHT,
        null,
      ),
    );
  }

  /**
   * Glass panes and, if its component has them, a frame and glazing bars (src/geometry/window.ts),
   * each a box swept up from its own height. A plain window is one pane filling the opening.
   */
  private window(win: Window, mid: number, openingPlacement: InstanceType<typeof IFC4.IfcLocalPlacement>) {
    const placement = this.placement(openingPlacement, win.width / 2, mid, 0);
    const design = win.componentId ? this.windowDesigns.get(win.componentId) : undefined;
    const { panes, bars, frame } = windowDivision(win, design);
    const partitioning = windowPartitioning(design);
    // Window-local X runs along the wall from the opening's centre; the rects are from its left edge.
    const piece = (r: Rect, depth: number, style: StyleName) => {
      const profile = this.rectangle(r.x + r.w / 2 - win.width / 2, 0, r.w, depth);
      const at = r.z === 0 ? null : new IFC4.IfcAxis2Placement3D(this.pt3(0, 0, r.z), null, null);
      const solid = new IFC4.IfcExtrudedAreaSolid(profile, at, this.zAxis, posLen(r.h));
      this.write(new IFC4.IfcStyledItem(solid, [this.surfaceStyle(style)], null));
      return solid;
    };
    const items = [
      ...panes.map((p) => piece(p, PANEL_THICKNESS, "glazing")),
      ...[...frame, ...bars].map((b) => piece(b, GLAZING_BAR_DEPTH, "frame")),
    ];
    const body = new IFC4.IfcShapeRepresentation(this.bodyCtx, label("Body"), label("SweptSolid"), items);
    return this.write(
      new IFC4.IfcWindow(
        guid(win.id),
        null,
        label(win.name ?? win.id),
        null,
        null,
        placement,
        new IFC4.IfcProductDefinitionShape(null, null, [body]),
        ident(win.id),
        posLen(win.height),
        posLen(win.width),
        IFC4.IfcWindowTypeEnum.WINDOW,
        partitioning.value,
        partitioning.userDefined === null ? null : label(partitioning.userDefined),
      ),
    );
  }

  /**
   * Door and window components become IfcDoorType / IfcWindowType, declared in the project and
   * linked to the doors and windows that use them. A door type's operation is NOTDEFINED: handing
   * (left or right) varies door by door, and each IfcDoor keeps its own.
   */
  private components(model: BuildingModel, project: InstanceType<typeof IFC4.IfcProject>) {
    const types: InstanceType<typeof IFC4.IfcTypeObject>[] = [];
    const define = (id: string, type: InstanceType<typeof IFC4.IfcTypeObject>) => {
      types.push(this.write(type));
      const used = this.instances.get(id);
      if (used?.length) this.write(new IFC4.IfcRelDefinesByType(guid(`${id}#instances`), null, null, null, used, type));
    };
    for (const c of model.components?.doors ?? []) {
      define(
        c.id,
        new IFC4.IfcDoorType(
          guid(c.id),
          null,
          label(c.name),
          null,
          null,
          null,
          null,
          label(c.id),
          null,
          IFC4.IfcDoorTypeEnum.DOOR,
          IFC4.IfcDoorTypeOperationEnum.NOTDEFINED,
          null,
          null,
        ),
      );
    }
    for (const c of model.components?.windows ?? []) {
      const partitioning = windowPartitioning(c);
      define(
        c.id,
        new IFC4.IfcWindowType(
          guid(c.id),
          null,
          label(c.name),
          null,
          null,
          null,
          null,
          label(c.id),
          null,
          IFC4.IfcWindowTypeEnum.WINDOW,
          partitioning.value,
          null,
          partitioning.userDefined === null ? null : label(partitioning.userDefined),
        ),
      );
    }
    if (types.length)
      this.write(new IFC4.IfcRelDeclares(guid(`${model.project.id}#types`), null, null, null, project, types));
  }

  /** Slab top is at storey + elevationOffset; it is swept upwards from (top − thickness). */
  private slab(s: Slab, parent: InstanceType<typeof IFC4.IfcLocalPlacement>) {
    const placement = this.placement(parent, 0, 0, s.elevationOffset - s.thickness);
    const profile = new IFC4.IfcArbitraryClosedProfileDef(
      IFC4.IfcProfileTypeEnum.AREA,
      null,
      this.closedPolyline(s.outline),
    );
    return this.write(
      new IFC4.IfcSlab(
        guid(s.id),
        null,
        label(s.name ?? s.id),
        null,
        null,
        placement,
        new IFC4.IfcProductDefinitionShape(null, null, [
          this.body(profile, s.thickness, s.material === "ground" ? "ground" : "slab"),
        ]),
        ident(s.id),
        IFC4.IfcSlabTypeEnum.FLOOR,
      ),
    );
  }

  /**
   * A stair: an IfcStair container in the storey, with its flights and landings aggregated under it.
   * The container carries no body, so the stair's geometry is counted once, through its parts.
   * `rise` is what it climbs, from the containing storey to the one it names.
   */
  private stair(s: Stair, parent: InstanceType<typeof IFC4.IfcLocalPlacement>, rise: number) {
    const placement = this.placement(parent, 0, 0, 0);
    const flights = s.segments.filter((seg): seg is StairFlight => seg.kind === "flight");
    const stair = this.write(
      new IFC4.IfcStair(
        guid(s.id),
        null,
        label(s.name ?? s.id),
        null,
        null,
        placement,
        null,
        ident(s.id),
        stairType(flights),
      ),
    );
    const levels = stairLevels(s, rise);
    const parts = levels.segments.map((l) =>
      l.kind === "flight"
        ? this.stairFlight(l.segment, l, levels.riser, placement)
        : this.stairLanding(l.segment, l.level, placement),
    );
    this.write(new IFC4.IfcRelAggregates(guid(`${s.id}#aggregates`), null, null, null, stair, parts));
    return stair;
  }

  /**
   * A flight: its stepped side profile extruded across its width. The placement's X runs along the
   * flight and its Y is up, so the profile's (along, up) lands in the placement's (X, Y) and the
   * extrusion along the placement's Z spans the width, centred on the start→end line.
   */
  private stairFlight(
    f: StairFlight,
    level: FlightLevel,
    riser: number,
    parent: InstanceType<typeof IFC4.IfcLocalPlacement>,
  ) {
    if (flightRun(f) === 0) throw new Error(`${f.id}: zero-run flight cannot be written to IFC`);
    const d = flightDirection(f);
    // The placement's Z, across the flight to the right of the run; the origin sits half a width to
    // the left so the extrusion is centred.
    const across = v(round9(d.y), round9(-d.x));
    const origin = v(f.start.x - across.x * (f.width / 2), f.start.y - across.y * (f.width / 2));
    const axis = new IFC4.IfcAxis2Placement3D(
      this.pt3(round9(origin.x), round9(origin.y), round9(level.base)),
      new IFC4.IfcDirection([real(across.x), real(across.y), real(0)]),
      new IFC4.IfcDirection([real(round9(d.x)), real(round9(d.y)), real(0)]),
    );
    const profile = new IFC4.IfcArbitraryClosedProfileDef(
      IFC4.IfcProfileTypeEnum.AREA,
      null,
      this.closedPolyline(flightProfile(f, level.going, riser).map((p) => v(round9(p.x), round9(p.y)))),
    );
    return this.write(
      new IFC4.IfcStairFlight(
        guid(f.id),
        null,
        label(f.id),
        null,
        null,
        new IFC4.IfcLocalPlacement(parent, axis),
        new IFC4.IfcProductDefinitionShape(null, null, [this.body(profile, f.width, "stair")]),
        ident(f.id),
        new IFC4.IfcInteger(f.risers),
        new IFC4.IfcInteger(f.risers - 1),
        posLen(round9(riser)),
        posLen(round9(level.going)),
        IFC4.IfcStairFlightTypeEnum.STRAIGHT,
      ),
    );
  }

  /**
   * A railing: an IfcRailing in the storey with a swept top rail and vertical posts. The rail solid
   * is oriented with its local Z along the 3D run and its local X across it, and positioned so its
   * top surface is `height` above the walking surface. Each post is a vertical box. All solids are
   * positioned in storey coordinates.
   */
  private railing(r: Railing, parent: InstanceType<typeof IFC4.IfcLocalPlacement>) {
    const g = railingGeometry(r);
    const placement = this.placement(parent, 0, 0, 0);
    const railAt = new IFC4.IfcAxis2Placement3D(
      this.pt3(round9(g.rail.start.x), round9(g.rail.start.y), round9(g.rail.start.z)),
      new IFC4.IfcDirection([
        real(round9(g.rail.direction.x)),
        real(round9(g.rail.direction.y)),
        real(round9(g.rail.direction.z)),
      ]),
      new IFC4.IfcDirection([real(round9(g.rail.across.x)), real(round9(g.rail.across.y)), real(0)]),
    );
    const rail = new IFC4.IfcExtrudedAreaSolid(
      this.rectangle(0, 0, RAIL_WIDTH, RAIL_DEPTH),
      railAt,
      this.zAxis,
      posLen(round9(g.rail.length)),
    );
    this.write(new IFC4.IfcStyledItem(rail, [this.surfaceStyle("railing")], null));
    const posts = g.posts.map((p) => {
      const at = new IFC4.IfcAxis2Placement3D(this.pt3(round9(p.at.x), round9(p.at.y), round9(p.base)), null, null);
      const solid = new IFC4.IfcExtrudedAreaSolid(
        this.rectangle(0, 0, POST_SIZE, POST_SIZE),
        at,
        this.zAxis,
        posLen(round9(p.top - p.base)),
      );
      this.write(new IFC4.IfcStyledItem(solid, [this.surfaceStyle("railing")], null));
      return solid;
    });
    const body = new IFC4.IfcShapeRepresentation(this.bodyCtx, label("Body"), label("SweptSolid"), [rail, ...posts]);
    const predefinedType =
      g.startBase === g.endBase ? IFC4.IfcRailingTypeEnum.GUARDRAIL : IFC4.IfcRailingTypeEnum.HANDRAIL;
    return this.write(
      new IFC4.IfcRailing(
        guid(r.id),
        null,
        label(r.name ?? r.id),
        null,
        null,
        placement,
        new IFC4.IfcProductDefinitionShape(null, null, [body]),
        ident(r.id),
        predefinedType,
      ),
    );
  }

  /** A landing: its outline swept down from its level by its thickness, as an IfcSlab LANDING. */
  private stairLanding(l: StairLanding, level: number, parent: InstanceType<typeof IFC4.IfcLocalPlacement>) {
    const placement = this.placement(parent, 0, 0, round9(level - l.thickness));
    const profile = new IFC4.IfcArbitraryClosedProfileDef(
      IFC4.IfcProfileTypeEnum.AREA,
      null,
      this.closedPolyline(l.outline),
    );
    return this.write(
      new IFC4.IfcSlab(
        guid(l.id),
        null,
        label(l.id),
        null,
        null,
        placement,
        new IFC4.IfcProductDefinitionShape(null, null, [this.body(profile, l.thickness, "stair")]),
        ident(l.id),
        IFC4.IfcSlabTypeEnum.LANDING,
      ),
    );
  }

  /**
   * Rooms have no height in the schema yet, so spaces carry only a 2D FootPrint. Name holds our id
   * (IFC convention: Name is the space number), LongName the room name.
   */
  private space(r: Room, parent: InstanceType<typeof IFC4.IfcLocalPlacement>) {
    const placement = this.placement(parent, 0, 0, 0);
    const footprint = new IFC4.IfcShapeRepresentation(this.footprintCtx, label("FootPrint"), label("Curve2D"), [
      this.closedPolyline(r.outline),
    ]);
    return this.write(
      new IFC4.IfcSpace(
        guid(r.id),
        null,
        label(r.id),
        null,
        null,
        placement,
        new IFC4.IfcProductDefinitionShape(null, null, [footprint]),
        label(r.name),
        IFC4.IfcElementCompositionEnum.ELEMENT,
        IFC4.IfcSpaceTypeEnum.INTERNAL,
        null,
      ),
    );
  }
}

/** Trim float noise from unit vectors (cos 90° etc.) so output is stable and readable. */
const round9 = (n: number): number => {
  const r = Math.round(n * 1e9) / 1e9;
  return r === 0 ? 0 : r;
};
