import * as WebIFC from "web-ifc";

/** One web-ifc API per process: Init() compiles the WASM, so the writer and the round-trip share it. */
let apiPromise: Promise<WebIFC.IfcAPI> | undefined;
export function ifcApi(): Promise<WebIFC.IfcAPI> {
  apiPromise ??= (async () => {
    const api = new WebIFC.IfcAPI();
    await api.Init();
    api.SetLogLevel(WebIFC.LogLevel.LOG_LEVEL_ERROR);
    return api;
  })();
  return apiPromise;
}
