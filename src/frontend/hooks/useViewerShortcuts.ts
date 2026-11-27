import { useEffect } from "react";
import type { ViewerApi } from "../scene/engine.js";
import type { ViewerState } from "../state/store.js";

const BAR_PICKERS = new Set(["model", "revision"]);
const ARROWS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

/** Storey, revision and Diff keyboard shortcuts, with the focus and walk-mode exceptions. */
export function useViewerShortcuts(engine: ViewerApi | null, state: ViewerState): void {
  useEffect(() => {
    if (!engine) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      // A focused switch is a checkbox: it has no arrows or typing of its own, so keep the shortcuts.
      const form =
        target instanceof HTMLElement &&
        target.matches("input:not([type=checkbox]):not([type=radio]), select, textarea");
      // The storey slider treats every arrow as its own step. The viewer decides instead, except in
      // first-person mode, where the arrows move the camera; stop the event before the slider's own handler sees it.
      const storeySlider = target instanceof HTMLElement && target.closest("#storeys") !== null && !state.walking;
      if (storeySlider && ARROWS.has(event.code)) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;

      if (event.code === "KeyD") {
        if (state.walking || event.repeat || !state.diffAvailable || form) return;
        event.preventDefault();
        void engine.toggleDiff();
        return;
      }

      if (event.code === "ArrowUp" || event.code === "ArrowDown") {
        if (state.walking || state.storeyDisabled) return;
        // Another form control keeps its own arrows.
        if (form) return;
        event.preventDefault();
        void engine.stepStorey(event.code === "ArrowUp" ? 1 : -1);
        return;
      }

      if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
        if (state.walking || state.revisionDisabled) return;
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
  }, [engine, state.walking, state.diffAvailable, state.storeyDisabled, state.revisionDisabled]);
}
