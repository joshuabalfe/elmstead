import { useEffect, useRef, useState } from "react";
import type { ViewerApi } from "../scene/engine.js";

export function Compass({ engine }: { engine: ViewerApi | null }) {
  const arrow = useRef<SVGPolygonElement>(null);
  const north = useRef<SVGTextElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!engine) return;
    return engine.onCompass((state) => {
      setVisible(Boolean(state?.visible));
      if (!state?.visible) return;
      arrow.current?.setAttribute("transform", `rotate(${(state.turn * 180) / Math.PI})`);
      // The N stays upright beyond the arrow's tip, as on the plan.
      north.current?.setAttribute("x", String(33 * Math.sin(state.turn)));
      north.current?.setAttribute("y", String(-33 * Math.cos(state.turn) + 5));
    });
  }, [engine]);

  return (
    <div id="compass" hidden={!visible}>
      <svg viewBox="-45 -45 90 90" role="img" aria-label="True north">
        <circle r="22" fill="rgba(255,255,255,.85)" stroke="#1a1a1a" strokeWidth="1" />
        <polygon ref={arrow} points="0,-20 8,10 0,4 -8,10" fill="#1a1a1a" />
        <text
          ref={north}
          x="0"
          y="-28"
          fontSize="14"
          fontWeight="bold"
          textAnchor="middle"
          fill="#1a1a1a"
          stroke="#f4f4f2"
          strokeWidth="3"
          paintOrder="stroke"
        >
          N
        </text>
      </svg>
    </div>
  );
}
