import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Connect, Plugin, PreviewServer, ViteDevServer } from "vite";
import { confinedPath } from "./serve.js";

export interface ElmsteadPluginOptions {
  /** Directory holding the IFCs and building JSON, from ELMSTEAD_OUT_DIR or out/. */
  out: string;
  /** Directory holding the web-ifc WASM, from node_modules. */
  wasmDir: string;
}

/** The model list, IFCs and WASM the viewer loads, confined to their directories. */
export function elmsteadRoutes({ out, wasmDir }: ElmsteadPluginOptions): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (url.pathname === "/models.json") {
      const models = existsSync(out)
        ? readdirSync(out)
            .filter((f) => f.endsWith(".ifc"))
            .map((f) => f.slice(0, -4))
            .sort()
        : [];
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(models));
      return;
    }
    const serve = (dir: string, prefix: string, type: string) => {
      const file = confinedPath(dir, url.pathname.slice(prefix.length));
      if (!file || !existsSync(file) || !statSync(file).isFile()) return false;
      res.setHeader("content-type", type);
      res.setHeader("cache-control", "no-store");
      createReadStream(file).pipe(res);
      return true;
    };
    const serveOr404 = (prefix: string, dir: string, type: string) => {
      if (!serve(dir, prefix, type)) {
        res.statusCode = 404;
        res.end();
      }
    };
    if (url.pathname.startsWith("/out/")) return serveOr404("/out/", out, "application/octet-stream");
    if (url.pathname.startsWith("/wasm/")) return serveOr404("/wasm/", wasmDir, "application/wasm");
    next();
  };
}

/** Serves the viewer's data in development and preview, and reloads on a rebuilt IFC in development. */
export function elmstead(options: ElmsteadPluginOptions): Plugin {
  return {
    name: "elmstead",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(elmsteadRoutes(options));
      server.watcher.add(join(options.out, "*.ifc"));
      // Atomic writes rename a temp file over the IFC, which can surface as "add" rather than "change".
      const reload = (file: string) => {
        if (file.startsWith(options.out) && file.endsWith(".ifc")) server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("change", reload);
      server.watcher.on("add", reload);
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(elmsteadRoutes(options));
    },
  };
}
