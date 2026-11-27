import type { View } from "../../shared/render/views.js";
import type { ViewerApi } from "../scene/engine.js";
import type { ViewerState } from "../state/store.js";

const FALLBACK_VIEWS: { view: View; label: string; title: string }[] = [
  { view: "sw", label: "SW", title: "" },
  { view: "se", label: "SE", title: "" },
  { view: "ne", label: "NE", title: "" },
  { view: "nw", label: "NW", title: "" },
  { view: "top", label: "Top", title: "" },
];

export function Toolbar({ state, engine }: { state: ViewerState; engine: ViewerApi | null }) {
  const views = state.viewLabels.length ? state.viewLabels : FALLBACK_VIEWS;

  return (
    <div id="bar">
      <select
        id="model"
        title="Model in out/"
        value={state.model}
        onChange={(e) => void engine?.chooseModel(e.target.value)}
      >
        {state.models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
      <select
        id="revision"
        title="Revision of this model: Existing is the building as it is (Left / Right arrows to step)"
        hidden={state.revisionHidden}
        value={state.revision ?? ""}
        onChange={(e) => void engine?.applyRevisionChoice(e.target.value || null)}
      >
        {state.revisions.map((revision) => (
          <option key={revision.value} value={revision.value} disabled={revision.disabled}>
            {revision.text}
          </option>
        ))}
      </select>
      <span id="storey-label" hidden={state.storeyLabelHidden}>
        Up to:
      </span>
      <select
        id="storeys"
        title="Show every storey up to and including this one (Up / Down arrows to step)"
        hidden={state.storeyLabelHidden}
        value={state.storeyValue}
        onChange={(e) => void engine?.applyStoreyChoice(e.target.value)}
      >
        {state.storeyCustom && (
          <option value="" disabled>
            Custom
          </option>
        )}
        {state.storeys.map((storey) => (
          <option key={storey.value} value={storey.value}>
            {storey.text}
          </option>
        ))}
      </select>
      <span>View:</span>
      {views.map((item) => (
        <button
          key={item.view}
          data-view={item.view}
          title={item.view === "top" ? undefined : item.title}
          onClick={() => void engine?.chooseView(item.view)}
        >
          {item.label}
        </button>
      ))}
      <button
        id="labels"
        title="Room labels and dimensions"
        aria-pressed={state.labels}
        onClick={() => engine?.toggleLabels()}
      >
        Labels
      </button>
      <button
        id="constraints"
        title="Measured constraints as red labels and dotted lines"
        aria-pressed={state.constraints}
        onClick={() => engine?.toggleConstraints()}
      >
        Constraints
      </button>
      <button id="ids" title="Element ids on hover" aria-pressed={state.ids} onClick={() => engine?.toggleIds()}>
        Ids
      </button>
      <button
        id="measure"
        title="Measure between two points"
        aria-pressed={state.measuring}
        onClick={() => void engine?.toggleMeasure()}
      >
        Measure
      </button>
      <button
        id="clear"
        title="Remove all measurements"
        disabled={!state.canClear}
        onClick={() => engine?.clearMeasurements()}
      >
        Clear
      </button>
      <button
        id="walk"
        title="First-person walk mode"
        aria-pressed={state.walking}
        onClick={() => void engine?.toggleWalk()}
      >
        Walk
      </button>
      <button
        id="diff"
        title="Colour what this revision adds, changes and removes, against Existing (D)"
        aria-pressed={state.diff}
        hidden={!state.diffAvailable}
        onClick={() => void engine?.toggleDiff()}
      >
        Diff
      </button>
      <button
        id="xray"
        title="Draw the elements see-through; with Diff, only the unchanged ones"
        aria-pressed={state.xray}
        onClick={() => void engine?.toggleXray()}
      >
        Transparency
      </button>
      <span id="status">{state.status}</span>
    </div>
  );
}
