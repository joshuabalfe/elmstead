import { z } from "zod";
import { BuildingModelSchema } from "./schema.js";

/** JSON Schema for the building JSON, as committed at schema/building.schema.json. */
export function jsonSchemaText(): string {
  const schema = z.toJSONSchema(BuildingModelSchema, { target: "draft-2020-12" });
  return (
    JSON.stringify(
      {
        ...schema,
        $id: "https://github.com/joshuabalfe/elmstead/schema/building.schema.json",
        title: "Elmstead building model",
      },
      null,
      2,
    ) + "\n"
  );
}
