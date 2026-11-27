import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChangesPanel } from "./components/ChangesPanel.js";
import { Compass } from "./components/Compass.js";
import { Hints } from "./components/Hints.js";
import { MeasurementList } from "./components/MeasurementList.js";
import { Toolbar } from "./components/Toolbar.js";
import { useViewerShortcuts } from "./hooks/useViewerShortcuts.js";
import { IFC_EVENT, type IfcEventPayload } from "./lib/ifc-event.js";
import { createViewer, type ViewerApi } from "./scene/engine.js";
import type { ViewerStore } from "./state/store.js";

export interface AppProps {
  store: ViewerStore;
}

export function App({ store }: AppProps) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [engine, setEngine] = useState<ViewerApi | null>(null);
  const container = useRef<HTMLDivElement>(null);
  useViewerShortcuts(engine, state);

  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
    let off: (() => void) | undefined;
    createViewer(container.current, store)
      .then(async (api) => {
        if (cancelled) return;
        setEngine(api);
        await api.start();
        if (cancelled) return;
        if (import.meta.hot) {
          const onIfc = (payload: IfcEventPayload) => void api.reloadModel(payload.name);
          import.meta.hot.on(IFC_EVENT, onIfc);
          off = () => import.meta.hot?.off(IFC_EVENT, onIfc);
        }
      })
      .catch((error: unknown) => {
        const message = String(error);
        store.set({ status: message, error: message });
      });
    return () => {
      cancelled = true;
      off?.();
    };
  }, [store]);

  useEffect(() => {
    document.body.classList.toggle("measuring", state.measuring);
  }, [state.measuring]);

  return (
    <>
      <div id="container" ref={container} />
      <Toolbar state={state} engine={engine} />
      <Hints state={state} />
      <MeasurementList state={state} />
      <ChangesPanel changes={state.changes} engine={engine} />
      <Compass engine={engine} />
    </>
  );
}
