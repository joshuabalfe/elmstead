import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render3d } from "../src/backend/render/index.js";

describe("render3d", () => {
  it("reports a viewer failure as an ERROR and closes the server", async () => {
    const dir = mkdtempSync(join(tmpdir(), "elmstead-snapshot-"));
    try {
      const r = await render3d("missing-model", dir);
      expect(r.written).toEqual([]);
      expect(r.issues).toHaveLength(1);
      expect(r.issues[0]).toMatchObject({ level: "ERROR", id: "missing-model.ifc" });
      expect(r.issues[0]!.message).toMatch(/^3D snapshots failed:/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
