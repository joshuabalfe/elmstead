import { writeFileSync } from "node:fs";
import { jsonSchemaText } from "../src/schema/json-schema.js";

const path = "schema/building.schema.json";
writeFileSync(path, jsonSchemaText());
console.log(`wrote ${path}`);
