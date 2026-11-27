import { Button, Divider, HTMLSelect, Icon, Slider, Switch } from "@blueprintjs/core";
import type { IconName } from "@blueprintjs/core";
import type { CSSProperties, HTMLAttributes } from "react";
import { CARDINAL_NAMES, CARDINALS, ELEVATION_NAMES, ELEVATIONS, type CameraView } from "../../shared/render/views.js";
import type { ViewerApi } from "../scene/engine.js";
import type { ViewerState } from "../state/store.js";

const FALLBACK_VIEWS: { view: CameraView; label: string; title: string }[] = [
  ...CARDINALS.map((view) => ({
    view,
    label: view.toUpperCase(),
    title: `Isometric view from true ${CARDINAL_NAMES[view]}`,
  })),
  ...ELEVATIONS.map((view) => ({
    view,
    label: ELEVATION_NAMES[view],
    title: `Flat ${ELEVATION_NAMES[view].toLowerCase()} elevation`,
  })),
  { view: "top", label: "Top", title: "Top view" },
];

function ToolSwitch(props: {
  id: string;
  icon: IconName;
  label: string;
  title: string;
  checked: boolean;
  disabled?: boolean;
  innerLabel?: string;
  innerLabelChecked?: string;
  onChange: () => void;
}) {
  return (
    <Switch
      className="nav-switch"
      id={props.id}
      checked={props.checked}
      disabled={props.disabled ?? false}
      alignIndicator="end"
      innerLabel={props.innerLabel ?? ""}
      innerLabelChecked={props.innerLabelChecked ?? ""}
      onChange={props.onChange}
      labelElement={
        <span className="nav-switch-label" title={props.title}>
          <Icon icon={props.icon} size={14} />
          {props.label}
        </span>
      }
    />
  );
}

export function Toolbar({ state, engine }: { state: ViewerState; engine: ViewerApi | null }) {
  const views = state.viewLabels.length ? state.viewLabels : FALLBACK_VIEWS;
  const viewsById = new Map(views.map((item) => [item.view, item]));
  const cameraSnap = (view: CameraView) => {
    const item = viewsById.get(view);
    if (!item) return null;
    return (
      <Button
        key={view}
        className={`camera-snap camera-snap-${view}`}
        data-view={view}
        title={view === "top" ? undefined : item.title}
        variant="solid"
        size="small"
        onClick={() => void engine?.chooseView(view)}
      >
        {item.label}
      </Button>
    );
  };
  const storey = state.storeys[state.storeyIndex];
  // The handle's props reach the span; Blueprint's type lists only the aria labels.
  const storeyHandleProps: HTMLAttributes<HTMLSpanElement> & { "data-storey": string } = {
    id: "storeys",
    "data-storey": state.storeyCustom ? "" : (storey?.value ?? ""),
    "aria-label": "Levels",
    "aria-valuetext": state.storeyCustom ? "Custom" : (storey?.text ?? ""),
    title: "Show every storey up to and including this one (Up / Down arrows to step)",
  };
  const storeySteps = Math.max(state.storeys.length - 1, 1);

  return (
    <nav id="bar" aria-label="Viewer controls">
      <HTMLSelect
        id="model"
        fill
        aria-label="Model"
        title="Model in out/"
        value={state.model}
        onChange={(e) => void engine?.chooseModel(e.target.value)}
      >
        {state.models.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </HTMLSelect>
      <div className="nav-group">
        <h2 className="nav-label">Model</h2>
        <div className="nav-field">
          <label className="nav-field-label" htmlFor="revision">
            Revision
          </label>
          <HTMLSelect
            id="revision"
            fill
            disabled={state.revisionDisabled}
            title="Revision of this model: Existing is the building as it is (Left / Right arrows to step)"
            value={state.revision ?? ""}
            onChange={(e) => void engine?.applyRevisionChoice(e.target.value || null)}
          >
            {state.revisions.map((revision) => (
              <option key={revision.value} value={revision.value} disabled={revision.disabled}>
                {revision.text}
              </option>
            ))}
          </HTMLSelect>
        </div>
        <div className="nav-field">
          <span className="nav-field-label">Levels</span>
          <div className="storey-slider" style={{ "--storey-steps": storeySteps } as CSSProperties}>
            <Slider
              vertical
              min={0}
              max={Math.max(state.storeys.length - 1, 1)}
              stepSize={1}
              value={Math.min(state.storeyIndex, Math.max(state.storeys.length - 1, 1))}
              disabled={state.storeyDisabled}
              labelValues={state.storeys.map((_, index) => index)}
              labelRenderer={(value, options) => {
                const option = state.storeys[value];
                if (!option) return "";
                if (options?.isHandleTooltip) return <Icon icon="eye-open" size={12} />;
                return (
                  <span
                    className={value === state.storeyIndex ? "storey-option storey-option-current" : "storey-option"}
                    data-storey={option.value}
                    title={`Show ${option.text} and every storey below`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (state.storeyDisabled) return;
                      if (!state.storeyCustom && value === state.storeyIndex) return;
                      void engine?.applyStoreyChoice(option.value);
                    }}
                  >
                    {option.text}
                  </span>
                );
              }}
              onChange={(value) => {
                const option = state.storeys[value];
                if (option) void engine?.applyStoreyChoice(option.value);
              }}
              handleHtmlProps={storeyHandleProps}
            />
          </div>
          {state.storeyCustom && <span className="nav-field-note storey-custom">Custom</span>}
        </div>
        <ToolSwitch
          id="labels"
          icon="tag"
          label="Show Labels"
          title="Room labels and dimensions"
          checked={state.labels}
          innerLabel="Off"
          innerLabelChecked="On"
          onChange={() => engine?.toggleLabels()}
        />
        <ToolSwitch
          id="xray"
          icon={state.xray ? "eye-open" : "eye-off"}
          label="Transparency"
          title="Draw the elements see-through; with Diff, only the unchanged ones"
          checked={state.xray}
          innerLabel="Off"
          innerLabelChecked="On"
          onChange={() => engine?.toggleXray()}
        />
        <ToolSwitch
          id="diff"
          icon="comparison"
          label="Revision Diff"
          title="Colour what this revision adds, changes and removes, against Existing (D)"
          checked={state.diff}
          disabled={!state.diffAvailable}
          innerLabel="Off"
          innerLabelChecked="On"
          onChange={() => void engine?.toggleDiff()}
        />
      </div>
      <Divider />
      <div className="nav-group">
        <h2 className="nav-label">Camera</h2>
        <div className="camera-elevations">
          {cameraSnap("front")}
          {cameraSnap("back")}
          {cameraSnap("left")}
          {cameraSnap("right")}
          {cameraSnap("top")}
        </div>
        <div className="camera-pad">
          {cameraSnap("n")}
          {cameraSnap("w")}
          {cameraSnap("e")}
          {cameraSnap("s")}
        </div>
        <Button
          id="walk"
          icon="walk"
          title="First-person walk mode"
          active={state.walking}
          aria-pressed={state.walking}
          fill
          variant="minimal"
          alignText="left"
          onClick={() => void engine?.toggleWalk()}
        >
          Walk
        </Button>
      </div>
      <Divider />
      <div className="nav-group">
        <h2 className="nav-label">Tools</h2>
        <ToolSwitch
          id="constraints"
          icon="selection"
          label="Show Constraints"
          title="Measured constraints as red labels and dotted lines"
          checked={state.constraints}
          innerLabel="Off"
          innerLabelChecked="On"
          onChange={() => engine?.toggleConstraints()}
        />
        <ToolSwitch
          id="ids"
          icon="property"
          label="Show IDs on Hover"
          title="Element ids on hover"
          checked={state.ids}
          innerLabel="Off"
          innerLabelChecked="On"
          onChange={() => engine?.toggleIds()}
        />
        <Button
          id="measure"
          icon="map-marker"
          title="Measure between two points"
          active={state.measuring}
          aria-pressed={state.measuring}
          fill
          variant="minimal"
          alignText="left"
          onClick={() => void engine?.toggleMeasure()}
        >
          Measure
        </Button>
        <Button
          id="clear"
          icon="eraser"
          title="Remove all measurements"
          disabled={!state.canClear}
          fill
          variant="minimal"
          alignText="left"
          onClick={() => engine?.clearMeasurements()}
        >
          Clear
        </Button>
      </div>
      <div id="status" role="status">
        {state.status}
      </div>
    </nav>
  );
}
