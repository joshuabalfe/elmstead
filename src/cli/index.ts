import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { formatIssue, hasErrors, type Issue } from "../checks/issue.js";
import { formatJson } from "./json-format.js";
import { loadModel, type LoadedModel } from "./load.js";

const OUT = "out";

const USAGE = `usage: elmstead <build|render|check|all> <models/name.ts>`;

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

async function main(argv: string[]): Promise<number> {
  const [command, modelPath] = argv;
  if (!command || !modelPath) {
    console.error(USAGE);
    return 2;
  }
  const loaded = await load(modelPath);
  const issues: Issue[] = [];
  switch (command) {
    case "build":
      console.log(`json    ${writeJson(loaded)}`);
      break;
    default:
      console.error(`unknown command "${command}"\n${USAGE}`);
      return 2;
  }
  print(issues);
  return hasErrors(issues) ? 1 : 0;
}

process.exitCode = await main(process.argv.slice(2));
