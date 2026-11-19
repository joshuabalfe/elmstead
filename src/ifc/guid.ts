import { createHash } from "node:crypto";

/**
 * Deterministic IFC GlobalIds: UUIDv5(PROJECT_NAMESPACE, key), compressed to IFC's 22-character form.
 * Element keys are element ids ("wall-north-1"); entities without an id of their own use a derived
 * key ("storey-ground#contains"). Changing this namespace changes every GlobalId — don't.
 */
export const PROJECT_NAMESPACE = "ccd47317-e750-4598-9af4-4e20a6f6deca";

const IFC_B64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";

export function uuidv5(namespace: string, name: string): string {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  if (ns.length !== 16) throw new Error(`invalid namespace UUID: ${namespace}`);
  const hash = createHash("sha1").update(ns).update(name, "utf8").digest().subarray(0, 16);
  hash[6] = (hash[6]! & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const h = hash.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Same as ifcopenshell.guid.compress: 128 bits → 2 + 21×6 bits in IFC's base-64 alphabet. */
export function compressGuid(uuid: string): string {
  let n = BigInt("0x" + uuid.replace(/-/g, ""));
  const chars: string[] = [];
  for (let i = 0; i < 22; i++) {
    chars.push(IFC_B64[Number(n & 63n)]!);
    n >>= 6n;
  }
  return chars.reverse().join("");
}

export const ifcGuid = (key: string): string => compressGuid(uuidv5(PROJECT_NAMESPACE, key));
