import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { formatIssue, hasErrors, type Issue } from "../checks/issue.js";
import { formatJson } from "./json-format.js";
import { loadModel, type LoadedModel } from "./load.js";
import { render3d, renderAll } from "../render/index.js";
import { existsSync } from "node:fs";
import { writeIfc } from "../ifc/writer.js";
import { validateIfc } from "../ifc/validate.js";
import { roundTripChecks } from "../ifc/roundtrip.js";
import { BuildingModelSchema } from "../schema/schema.js";

const OUT = "out";

const USAGE = `usage: elmstead <build|render|check|all> <models/name.ts | models/name/> [--ids] [--no-3d]`;

function print(issues: readonly Issue[]) {
  for (const i of issues) console.log(formatIssue(i));
}

async function load(path: string): Promise<LoadedModel> {
  const r = await loadModel(path);
  if (!r.ok) {
    print(r.issues);
    console.log(`FAILED  ${path}: model did not validate`);
    process.exit(1);
  }
  return r.value;
}

function writeJson({ name, model }: LoadedModel): string {
  mkdirSync(OUT, { recursive: true });
  const path = join(OUT, `${name}.building.json`);
  writeFileSync(path, formatJson(model));
  return path;
}

/** JSON → IFC → IfcOpenShell validation. The IFC is written from the JSON file, the contract between the two halves. */
async function buildIfc(name: string, jsonPath: string, issues: Issue[]): Promise<void> {
  const model = BuildingModelSchema.parse(JSON.parse(readFileSync(jsonPath, "utf8")));
  const ifcPath = join(OUT, `${name}.ifc`);
  const ifc = await writeIfc(model, { fileName: `${name}.ifc` });
  writeFileSync(ifcPath, ifc);
  console.log(`ifc     ${ifcPath}`);
  const rt = await roundTripChecks(model, ifc);
  issues.push(...rt);
  console.log(`geom    ${ifcPath}: ${rt.length ? `${rt.length} problems` : "every element meshes in web-ifc; opening cuts verified by volume"}`);
  const v = validateIfc(ifcPath);
  issues.push(...v.issues);
  console.log(`valid   ${ifcPath}: ${v.errors} errors, ${v.warnings} warnings (ifcopenshell.validate)`);
}

async function main(argv: string[]): Promise<number> {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const [command, modelPath] = argv.filter((a) => !a.startsWith("--"));
  if (!command || !modelPath) {
    console.error(USAGE);
    return 2;
  }
  const loaded = await load(modelPath);
  const issues: Issue[] = [];
  switch (command) {
    case "build": {
      const jsonPath = writeJson(loaded);
      console.log(`json    ${jsonPath}`);
      await buildIfc(loaded.name, jsonPath, issues);
      break;
    }
    case "render": {
      for (const p of renderAll(loaded.name, loaded.model, OUT, { ids: flags.has("--ids") })) console.log(`render  ${p}`);
      if (flags.has("--no-3d")) break;
      if (!existsSync(join(OUT, `${loaded.name}.ifc`))) {
        issues.push({ level: "WARNING", id: loaded.name, message: "3D snapshots skipped: no IFC yet — run build first" });
        break;
      }
      const r = await render3d(loaded.name, OUT);
      for (const p of r.written) console.log(`render  ${p}`);
      issues.push(...r.issues);
      break;
    }
    default:
      console.error(`unknown command "${command}"\n${USAGE}`);
      return 2;
  }
  print(issues);
  return hasErrors(issues) ? 1 : 0;
}

process.exitCode = await main(process.argv.slice(2));
