import type { ViewerState } from "../state/store.js";

export function MeasurementList({ state }: { state: ViewerState }) {
  return (
    <ol id="measure-list" aria-label="Measurements" hidden={state.measurements.length === 0}>
      {state.measurements.map((row) => (
        <li key={row.id}>{row.summary}</li>
      ))}
    </ol>
  );
}
