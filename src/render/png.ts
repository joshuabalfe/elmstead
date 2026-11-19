import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { PNG_ZOOM } from "./style.js";

const require = createRequire(import.meta.url);
const fontDir = join(dirname(require.resolve("dejavu-fonts-ttf/package.json")), "ttf");

/** SVG → PNG with bundled fonts only, so output does not depend on the machine's installed fonts. */
export function svgToPng(svg: string): Buffer {
  const r = new Resvg(svg, {
    fitTo: { mode: "zoom", value: PNG_ZOOM },
    font: {
      loadSystemFonts: false,
      fontFiles: [join(fontDir, "DejaVuSans.ttf"), join(fontDir, "DejaVuSans-Bold.ttf")],
      defaultFontFamily: "DejaVu Sans",
    },
  });
  return r.render().asPng();
}
