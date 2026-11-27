import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { elmstead, type ElmsteadPluginOptions } from "../src/frontend/vite/plugin.js";

type Handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function tempDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "elmstead-plugin-"));
  for (const [name, contents] of Object.entries(files)) writeFileSync(join(dir, name), contents);
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function install(hook: unknown, server: unknown): void {
  if (typeof hook === "function") return (hook as (server: unknown) => void)(server);
  if (hook && typeof hook === "object" && "handler" in hook) {
    return (hook as { handler: (server: unknown) => void }).handler(server);
  }
  throw new Error("plugin hook is not installable");
}

function handlers(options: ElmsteadPluginOptions): Record<"dev" | "preview", Handler> {
  const plugin = elmstead(options);
  const dev: Handler[] = [];
  const preview: Handler[] = [];

  install(plugin.configureServer, {
    middlewares: { use: (handler: Handler) => dev.push(handler) },
    watcher: { add() {}, on() {} },
    ws: { send() {} },
  });
  install(plugin.configurePreviewServer, {
    middlewares: { use: (handler: Handler) => preview.push(handler) },
  });

  if (!dev[0] || !preview[0]) throw new Error("middleware not installed");
  return { dev: dev[0], preview: preview[0] };
}

async function listen(handler: Handler): Promise<string> {
  const server = createServer((req, res) =>
    handler(req, res, () => {
      res.statusCode = 418;
      res.end("next");
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server has no port");
  cleanups.push(() => server.close());
  return `http://127.0.0.1:${address.port}`;
}

describe("viewer plugin routes", () => {
  it.each(["dev", "preview"] as const)("serves models and files in %s", async (mode) => {
    const out = tempDir({ "b.ifc": "B", "a.ifc": "A", "a.building.json": "{}" });
    const wasm = tempDir({ "web-ifc.wasm": "wasm" });
    const url = await listen(handlers({ out, wasmDir: wasm })[mode]);

    expect(await (await fetch(`${url}/models.json`)).json()).toEqual(["a", "b"]);
    expect(await (await fetch(`${url}/out/a.ifc`)).text()).toBe("A");
    expect(await (await fetch(`${url}/wasm/web-ifc.wasm`)).text()).toBe("wasm");
    expect((await fetch(`${url}/out/missing.ifc`)).status).toBe(404);
    expect((await fetch(`${url}/out/..%2fsecret.ifc`)).status).toBe(404);
    expect(await (await fetch(`${url}/unknown`)).text()).toBe("next");
  });
});
