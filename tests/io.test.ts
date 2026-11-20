import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeFileAtomic } from "../src/io.js";

const dirs: string[] = [];
const tempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "elmstead-io-"));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("writeFileAtomic", () => {
  it("writes text and binary data", () => {
    const dir = tempDir();
    const text = join(dir, "a.txt");
    const bin = join(dir, "b.bin");
    writeFileAtomic(text, "hello");
    writeFileAtomic(bin, new Uint8Array([1, 2, 3]));
    expect(readFileSync(text, "utf8")).toBe("hello");
    expect([...readFileSync(bin)]).toEqual([1, 2, 3]);
  });

  it("leaves the previous file intact when the write fails", () => {
    const dir = tempDir();
    const path = join(dir, "out.json");
    writeFileSync(path, "old");
    mkdirSync(`${path}.tmp`); // the temporary path cannot be written as a file
    expect(() => writeFileAtomic(path, "new")).toThrow();
    expect(readFileSync(path, "utf8")).toBe("old");
  });
});