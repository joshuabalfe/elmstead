import react from "@vitejs/plugin-react";
import { join } from "node:path";
import { defineConfig } from "vite";
import { outDir, PROJECT_ROOT } from "../../backend/root.js";
import { elmstead } from "./plugin.js";

const out = outDir();
const wasmDir = join(PROJECT_ROOT, "node_modules", "web-ifc");

export default defineConfig({
  root: join(import.meta.dirname, ".."),
  plugins: [elmstead({ out, wasmDir }), react()],
  server: { port: 5173, strictPort: false },
  preview: { port: 4173, strictPort: false },
  build: { outDir: "../../dist", emptyOutDir: true },
  logLevel: "warn",
});
