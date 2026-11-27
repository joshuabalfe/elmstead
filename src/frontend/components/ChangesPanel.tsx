import type { ViewerApi } from "../scene/engine.js";
import type { ChangesState } from "../state/store.js";

export function ChangesPanel({ changes, engine }: { changes: ChangesState | null; engine: ViewerApi | null }) {
  return (
    <div id="changes" aria-label="Changes" hidden={!changes}>
      {changes && (
        <>
          {changes.categories.map((category) => (
            <label key={category.status}>
              <input
                type="checkbox"
                checked={category.checked}
                data-status={category.status}
                onChange={(e) => void engine?.setChangeCategory(category.status, e.target.checked)}
              />
              <span className="swatch" style={{ background: category.fill, borderColor: category.accent }} />
              {category.count} {category.status}
            </label>
          ))}
          {changes.groups.map((group) => (
            <div key={group.storeyId}>
              <h3>{group.storeyName}</h3>
              <ul>
                {group.entries.map((entry) => (
                  <li key={`${entry.status}-${entry.id}`}>
                    <button
                      data-id={entry.id}
                      style={{ color: entry.color }}
                      onClick={() => void engine?.flyToChange(entry.id, entry.status, group.storeyId)}
                    >
                      {entry.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
