import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { outDir, PROJECT_ROOT } from "../src/root.js";
import { confinedPath } from "./serve.js";

const out = outDir();
const wasmDir = join(PROJECT_ROOT, "node_modules", "web-ifc");

/**
 * Serves out/*.ifc and the web-ifc wasm locally (no CDN), lists models at /models.json, and reloads
 * the page whenever an IFC in out/ is rebuilt.
 */
function elmstead(): Plugin {
  return {
    name: "elmstead",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
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
      });
      server.watcher.add(join(out, "*.ifc"));
      // Atomic writes rename a temp file over the IFC, which can surface as "add" rather than "change".
      const reload = (f: string) => {
        if (f.startsWith(out) && f.endsWith(".ifc")) server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("change", reload);
      server.watcher.on("add", reload);
    },
  };
}

export default defineConfig({
  root: import.meta.dirname,
  plugins: [elmstead()],
  server: { port: 5173, strictPort: false },
  logLevel: "warn",
});
