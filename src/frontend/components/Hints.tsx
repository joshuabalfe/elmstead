import type { ViewerState } from "../state/store.js";

export function Hints({ state }: { state: ViewerState }) {
  return (
    <>
      <div id="walk-hint" hidden={!state.walkHint}>
        Click to look around · WASD or arrow keys to move · Esc to leave
      </div>
      <div id="measure-hint" hidden={!state.measureHint}>
        Click two points on the model · the second aligns to the nearest axis · Esc cancels
      </div>
    </>
  );
}
