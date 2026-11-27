import { useEffect } from "react";
import type { ViewerApi } from "../scene/engine.js";
import type { ViewerState } from "../state/store.js";

const BAR_PICKERS = new Set(["model", "storeys", "revision"]);

/** Storey, revision and Diff keyboard shortcuts, with the focus and walk-mode exceptions. */
export function useViewerShortcuts(engine: ViewerApi | null, state: ViewerState): void {
  useEffect(() => {
    if (!engine) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      const form = target instanceof HTMLElement && target.matches("input, select, textarea");

      if (event.code === "KeyD") {
        if (state.walking || event.repeat || !state.diffAvailable || form) return;
        event.preventDefault();
        void engine.toggleDiff();
        return;
      }

      if (event.code === "ArrowUp" || event.code === "ArrowDown") {
        if (state.walking || state.storeyLabelHidden) return;
        // A focused select would also move its own value, and the opposite way round: its floors
        // run lowest first. Prevent repeats too, or the select still moves on them.
        if (form && (target as HTMLElement).id !== "storeys") return;
        event.preventDefault();
        void engine.stepStorey(event.code === "ArrowUp" ? 1 : -1);
        return;
      }

      if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
        if (state.walking || state.revisionHidden) return;
        if (form && !BAR_PICKERS.has((target as HTMLElement).id)) return;
        event.preventDefault();
        if (event.repeat) return;
        void engine.stepRevision(event.code === "ArrowRight" ? 1 : -1);
      }
    };
    // Capture so preventDefault runs before a focused select's native arrow handling, which would
    // otherwise move the select and the shortcut both.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [engine, state.walking, state.diffAvailable, state.storeyLabelHidden, state.revisionHidden]);
}
