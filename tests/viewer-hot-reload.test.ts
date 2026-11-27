/**
 * Rebuilt IFCs in the viewer: a save replaces only the changed model, keeps the camera and the
 * page, and refreshes the pickers, JSON, Diff and ghosts. Uses the Diff-mode harness for the
 * cottage and its revisions.
 */
import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatJson } from "../src/backend/cli/json-format.js";
import { writeIfc } from "../src/backend/ifc/writer.js";
import { addTo, mm, pt, revise, wall } from "../src/backend/model/index.js";
import type { BuildingModel } from "../src/shared/schema/schema.js";
import {
  COTTAGE,
  REV,
  TWO,
  VIEWPORT,
  drawn,
  model,
  open,
  outDir,
  page,
  picturesDuring,
  pixels,
  same,
  useDiffMode,
  viewChange,
} from "./support/diff-mode-page.js";

declare global {
  interface Window {
    __elmsteadReloads?: number;
    __reloadSentinel?: number;
    __elmsteadRoomLabels?: string[][];
    __elmsteadMeasurements?: {
      id: number;
      from: { x: number; y: number; z: number };
      to: { x: number; y: number; z: number };
      values: { straightMm: number; horizontalMm: number; verticalMm: number };
    }[];
  }
}

useDiffMode();

/** Write an IFC and its JSON as `build` does: both renamed into place, so a watcher sees a whole file. */
async function publishAtomic(name: string, building: BuildingModel, { ifc = true } = {}): Promise<void> {
  const json = join(outDir, `${name}.building.json`);
  writeFileSync(`${json}.tmp`, formatJson(building));
  renameSync(`${json}.tmp`, json);
  if (ifc) {
    const target = join(outDir, `${name}.ifc`);
    writeFileSync(`${target}.tmp`, await writeIfc(building, { fileName: `${name}.ifc` }));
    renameSync(`${target}.tmp`, target);
  }
}

const cottage = (): Promise<BuildingModel> => model("models/examples/example-cottage");
const reloads = (): Promise<number> => page.evaluate(() => window.__elmsteadReloads ?? 0);

async function settled(before: number): Promise<void> {
  await page.waitForFunction((n: number) => (window.__elmsteadReloads ?? 0) > n, before, { timeout: 60_000 });
  await drawn();
}

/** The original cottage, so each test starts from the model the harness published. */
async function resetCottage(): Promise<void> {
  await publishAtomic(COTTAGE, await cottage());
}

/** A visible ground-floor wall that changes the picture but is not in the revision. */
function extraWall(id: string): ReturnType<typeof wall> {
  return wall(id, pt(mm(0), mm(0)), pt(mm(0), mm(3000)), { thickness: mm(200), height: mm(3000) });
}

describe("rebuilt IFCs", () => {
  it("reloads the shown model in place, keeping the camera and the page", async () => {
    await resetCottage();
    await open(`model=${COTTAGE}&view=top&style=plan&camera=16,11,6,5.2,1.5,-4.2`);
    await page.click('[data-view="nw"]');
    await drawn();
    const before = await pixels();
    await page.evaluate(() => (window.__reloadSentinel = 1));

    const beforeReloads = await reloads();
    await publishAtomic(COTTAGE, await cottage());
    await settled(beforeReloads);

    expect(await page.evaluate(() => window.__reloadSentinel)).toBe(1);
    expect(same(await pixels(), before)).toBe(true);
  }, 120_000);

  it("shows a changed rebuild without a blank frame", async () => {
    await resetCottage();
    await open(`model=${COTTAGE}&view=se&style=plan`);
    const before = await pixels();
    const base = await cottage();
    const changed = revise(base, [addTo(base.storeys[0]!.id, { walls: [extraWall("wall-hot-reload")] })]);

    const beforeReloads = await reloads();
    const pictures = await picturesDuring(async () => {
      await publishAtomic(COTTAGE, changed);
      await settled(beforeReloads);
    });

    expect(same(await pixels(), before)).toBe(false);
    expect(pictures).toBe(2);
  }, 120_000);

  it("re-reads the building JSON on a rebuild", async () => {
    await resetCottage();
    await open(`model=${COTTAGE}&view=top&style=plan`);
    const before = await page.evaluate(() => window.__elmsteadRoomLabels ?? []);
    const renamed = await cottage();
    renamed.storeys[0]!.rooms[0]!.name = "Reloaded room";

    const beforeReloads = await reloads();
    await publishAtomic(COTTAGE, renamed);
    await settled(beforeReloads);

    const after = await page.evaluate(() => window.__elmsteadRoomLabels ?? []);
    expect(after).not.toEqual(before);
    expect(after.flat().join(" ")).toContain("Reloaded room");
  }, 120_000);

  it("clears measurements when the shown model is rebuilt", async () => {
    await resetCottage();
    await open(`model=${COTTAGE}&view=top&style=plan&measure=1`);
    await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2);
    await page.mouse.click(VIEWPORT.width / 2 + 100, VIEWPORT.height / 2);
    await page.waitForFunction(() => (window.__elmsteadMeasurements?.length ?? 0) === 1, null, { timeout: 10_000 });

    const beforeReloads = await reloads();
    await publishAtomic(COTTAGE, await cottage());
    await settled(beforeReloads);

    expect(await page.evaluate(() => window.__elmsteadMeasurements ?? [])).toHaveLength(0);
  }, 120_000);

  it("leaves the scene alone when another model is rebuilt", async () => {
    await resetCottage();
    await open(`model=${COTTAGE}&view=top&style=plan`);
    const before = await pixels();
    const beforeReloads = await reloads();
    const refreshed = page.waitForResponse((response) => new URL(response.url()).pathname === "/models.json");
    await publishAtomic(TWO, await model("tests/fixtures/two-storey"));
    await refreshed;
    await page.waitForTimeout(200);

    expect(await reloads()).toBe(beforeReloads);
    expect(same(await pixels(), before)).toBe(true);
  }, 120_000);

  it("adds a newly built revision to the picker without navigating", async () => {
    await resetCottage();
    await open(`model=${COTTAGE}&view=top&style=plan`);
    await page.evaluate(() => (window.__reloadSentinel = 1));
    await publishAtomic(
      `${COTTAGE}@hot-revision`,
      await model("models/examples/example-cottage/revisions/rear-extension.ts"),
    );

    await page.waitForFunction(
      (name: string) =>
        [...document.querySelectorAll<HTMLOptionElement>("#revision option")].some((o) => o.value === name),
      "hot-revision",
      { timeout: 60_000 },
    );
    expect(await page.inputValue("#revision")).toBe("");
    expect(await page.evaluate(() => window.__reloadSentinel)).toBe(1);
  }, 120_000);

  it("ends walk mode when the shown model is rebuilt", async () => {
    await resetCottage();
    await open(`model=${COTTAGE}&view=top&style=plan&walk=1`);
    expect(await page.getAttribute("#walk", "aria-pressed")).toBe("true");

    const beforeReloads = await reloads();
    await publishAtomic(COTTAGE, await cottage());
    await settled(beforeReloads);

    expect(await page.getAttribute("#walk", "aria-pressed")).toBe("false");
  }, 120_000);

  it("redraws the Diff when its base is rebuilt", async () => {
    await resetCottage();
    await open(`${REV}&view=se&diff=1`);
    const before = await page.evaluate(() => window.__elmsteadGhosts ?? []);
    const base = await cottage();
    const changed = revise(base, [addTo(base.storeys[0]!.id, { walls: [extraWall("wall-hot-base")] })]);

    const beforeReloads = await reloads();
    await publishAtomic(COTTAGE, changed);
    await settled(beforeReloads);

    const after = await page.evaluate(() => window.__elmsteadGhosts ?? []);
    expect(after).not.toEqual(before);
    expect(after).toContain("wall-hot-base");
  }, 120_000);

  it("uses a rebuilt base when Diff is turned on later", async () => {
    await resetCottage();
    await open(`${REV}&view=se&diff=1`);
    await viewChange(() => page.click("#diff"));
    expect(await page.evaluate(() => window.__elmsteadDiff ?? null)).toBeNull();

    const base = await cottage();
    const changed = revise(base, [addTo(base.storeys[0]!.id, { walls: [extraWall("wall-hot-late")] })]);
    const refreshed = page.waitForResponse((response) => new URL(response.url()).pathname === "/models.json");
    await publishAtomic(COTTAGE, changed);
    await refreshed;
    await page.waitForTimeout(300);

    await viewChange(() => page.click("#diff"));
    expect(await page.evaluate(() => window.__elmsteadGhosts ?? [])).toContain("wall-hot-late");
  }, 120_000);

  it("reports an unreadable rebuild and recovers", async () => {
    await resetCottage();
    await open(`model=${COTTAGE}&view=top&style=plan`);
    const beforeReloads = await reloads();
    const target = join(outDir, `${COTTAGE}.ifc`);
    writeFileSync(`${target}.bad`, "not an ifc");
    renameSync(`${target}.bad`, target);

    await page.waitForFunction(
      () => document.querySelector("#status")?.textContent?.includes("could not reload") ?? false,
      null,
      { timeout: 60_000 },
    );
    expect(await reloads()).toBe(beforeReloads);

    await publishAtomic(COTTAGE, await cottage());
    await settled(beforeReloads);
    expect(await page.textContent("#status")).toContain(`${COTTAGE}.ifc`);
  }, 120_000);
});
