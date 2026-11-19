import { describe, expect, it } from "vitest";
import { compressGuid, ifcGuid, uuidv5 } from "../src/ifc/guid.js";

describe("deterministic IFC GlobalIds", () => {
  it("uuidv5 matches the RFC 4122 reference (Python uuid.uuid5(NAMESPACE_DNS, 'python.org'))", () => {
    expect(uuidv5("6ba7b810-9dad-11d1-80b4-00c04fd430c8", "python.org")).toBe("886313e1-3b8a-5372-9b90-0c9aee199e5d");
  });

  it("compressGuid matches ifcopenshell.guid.compress", () => {
    expect(compressGuid("00000000000000000000000000000000")).toBe("0000000000000000000000");
    expect(compressGuid("ffffffffffffffffffffffffffffffff")).toBe("3$$$$$$$$$$$$$$$$$$$$$");
    expect(compressGuid("600f2f0f-d020-5153-8dbf-99d5fb11614b")).toBe("1W3oyFq21HKus$cTNx4M5B");
  });

  // Reference values computed with Python uuid.uuid5 + ifcopenshell.guid.compress (0.9.0.post1).
  it.each([
    ["wall-north-1", "1W3oyFq21HKus$cTNx4M5B"],
    ["door-front", "0RvS5G4bnHH9PD1$3Dyu62"],
    ["storey-ground#contains", "2$qcONzu1Pw8hDhtn6sEWi"],
  ])("ifcGuid(%s) is stable and matches IfcOpenShell", (key, expected) => {
    expect(ifcGuid(key)).toBe(expected);
    expect(ifcGuid(key)).toBe(ifcGuid(key));
  });

  it("different keys give different 22-character GlobalIds", () => {
    const a = ifcGuid("wall-a");
    expect(a).toHaveLength(22);
    expect(a).not.toBe(ifcGuid("wall-b"));
  });
});
