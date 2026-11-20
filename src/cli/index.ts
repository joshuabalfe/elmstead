import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { formatIssue, hasErrors, type Issue } from "../checks/issue.js";
import { checkModel } from "../checks/model.js";
import { writeIfc } from "../ifc/writer.js";
import { roundTripChecks } from "../ifc/roundtrip.js";
import { validateIfc } from "../ifc/validate.js";
import { writeFileAtomic } from "../io.js";
import { render3d, renderAll } from "../render/index.js";
import { outDir } from "../root.js";
import { BuildingModelSchema, type BuildingModel } from "../schema/schema.js";
import { formatJson } from "./json-format.js";
import { loadModel, type LoadedModel } from "./load.js";

const USAGE = `usage: elmstead <build|render|check|all> <models/name.ts | models/name/> [--ids] [--no-3d]`;
const COMMANDS = new Set(["build", "render", "check", "all"]);

function print(issues: readonly Issue[]) {
  for (const i of issues) console.log(formatIssue(i));
}

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Geometry round-trip and IfcOpenShell validation of an IFC already written to disk. */
async function verifyIfc(model: BuildingModel, ifc: Uint8Array, ifcPath: string, issues: Issue[]): Promise<void> {
  const rt = await roundTripChecks(model, ifc);
  issues.push(...rt);
  console.log(`geom    ${ifcPath}: ${rt.length ? `${rt.length} problems` : "every element meshes in web-ifc; opening cuts verified by volume"}`);
  const v = validateIfc(ifcPath);
  issues.push(...v.issues);
  console.log(`valid   ${ifcPath}: ${v.errors} errors, ${v.warnings} warnings (ifcopenshell.validate)`);
}

/** Returns true when the build wrote its files without an ERROR. */
async function runBuild(loaded: LoadedModel, out: string, issues: Issue[]): Promise<boolean> {
  const checked = checkModel(loaded.model);
  issues.push(...checked);
  if (hasErrors(checked)) return false; // nothing written: fix the model first
  // Build both artefacts in memory first, so a writer failure cannot leave new JSON beside an old IFC.
  const json = formatJson(loaded.model);
  const model = BuildingModelSchema.parse(JSON.parse(json));
  const ifc = await writeIfc(model, { fileName: `${loaded.name}.ifc` });
  mkdirSync(out, { recursive: true });
  const jsonPath = join(out, `${loaded.name}.building.json`);
  const ifcPath = join(out, `${loaded.name}.ifc`);
  writeFileAtomic(jsonPath, json);
  writeFileAtomic(ifcPath, ifc);
  console.log(`json    ${jsonPath}`);
  console.log(`ifc     ${ifcPath}`);
  await verifyIfc(model, ifc, ifcPath, issues);
  return !hasErrors(issues);
}

async function runRender(loaded: LoadedModel, out: string, flags: Set<string>, issues: Issue[]): Promise<void> {
  const checked = checkModel(loaded.model);
  issues.push(...checked);
  if (hasErrors(checked)) return; // nothing written: fix the model first
  for (const p of renderAll(loaded.name, loaded.model, out, { ids: flags.has("--ids") })) console.log(`render  ${p}`);
  if (flags.has("--no-3d")) return;
  if (!existsSync(join(out, `${loaded.name}.ifc`))) {
    issues.push({ level: "WARNING", id: loaded.name, message: "3D snapshots skipped: no IFC yet — run build first" });
    return;
  }
  const r = await render3d(loaded.name, out);
  for (const p of r.written) console.log(`render  ${p}`);
  issues.push(...r.issues);
}

async function main(argv: string[]): Promise<number> {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const [command, modelPath] = argv.filter((a) => !a.startsWith("--"));
  if (!command || !modelPath) {
    console.error(USAGE);
    return 2;
  }
  if (!COMMANDS.has(command)) {
    console.error(`unknown command "${command}"\n${USAGE}`);
    return 2;
  }
  const issues: Issue[] = [];
  try {
    const result = await loadModel(modelPath);
    if (!result.ok) {
      print(result.issues);
      console.log(`FAILED  ${modelPath}: model did not validate`);
      return 1;
    }
    const loaded = result.value;
    const out = outDir();
    switch (command) {
      case "build":
        await runBuild(loaded, out, issues);
        break;
      case "render":
        await runRender(loaded, out, flags, issues);
        break;
      case "check":
        issues.push(...checkModel(loaded.model));
        break;
      case "all":
        if (await runBuild(loaded, out, issues)) await runRender(loaded, out, flags, issues);
        break;
    }
  } catch (e) {
    issues.push({ level: "ERROR", id: modelPath, message: messageOf(e) });
  }
  print(issues);
  return hasErrors(issues) ? 1 : 0;
}

process.exitCode = await main(process.argv.slice(2));