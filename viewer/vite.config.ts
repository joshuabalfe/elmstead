import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const root = resolve(import.meta.dirname, "..");
// ELMSTEAD_OUT_DIR lets tests serve models from a temporary folder instead of out/.
const outDir = process.env.ELMSTEAD_OUT_DIR ? resolve(process.env.ELMSTEAD_OUT_DIR) : join(root, "out");
const wasmDir = join(root, "node_modules", "web-ifc");

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
          const models = existsSync(outDir) ? readdirSync(outDir).filter((f) => f.endsWith(".ifc")).map((f) => f.slice(0, -4)).sort() : [];
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(models));
          return;
        }
        const serve = (dir: string, prefix: string, type: string) => {
          const file = join(dir, decodeURIComponent(url.pathname.slice(prefix.length)));
          if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) return false;
          res.setHeader("content-type", type);
          res.setHeader("cache-control", "no-store");
          createReadStream(file).pipe(res);
          return true;
        };
        if (url.pathname.startsWith("/out/") && serve(outDir, "/out/", "application/octet-stream")) return;
        if (url.pathname.startsWith("/wasm/") && serve(wasmDir, "/wasm/", "application/wasm")) return;
        next();
      });
      server.watcher.add(join(outDir, "*.ifc"));
      server.watcher.on("change", (f) => {
        if (f.startsWith(outDir) && f.endsWith(".ifc")) server.ws.send({ type: "full-reload" });
      });
    },
  };
}

export default defineConfig({
  root: import.meta.dirname,
  plugins: [elmstead()],
  server: { port: 5173, strictPort: false },
  logLevel: "warn",
});
