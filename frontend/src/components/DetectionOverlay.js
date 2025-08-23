import React, { useEffect, useState } from "react";

/**
 * Props:
 *  - src: object/data URL of the uploaded image
 *  - natural: { width, height } (natural size of the image)
 *  - detections: [{ coords:[x1,y1,x2,y2], label?, confidence? }]
 *  - maxWidth: CSS display width (keeps aspect ratio)
 */
export default function DetectionOverlay({ src, natural, detections, maxWidth = 720 }) {
  const [display, setDisplay] = useState({ width: 0, height: 0, scale: 1 });

  useEffect(() => {
    if (!natural?.width || !natural?.height) return;
    const width = Math.min(maxWidth, natural.width);
    const scale = width / natural.width;
    const height = natural.height * scale;
    setDisplay({ width, height, scale });
  }, [natural, maxWidth]);

  return (
    <div style={{ position: "relative", width: display.width, height: display.height, background: "#111" }}>
      {src && (
        <>
          <img
            src={src}
            alt="uploaded"
            style={{ width: display.width, height: display.height, objectFit: "contain", display: "block" }}
          />
          <svg
            width={display.width}
            height={display.height}
            style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
          >
            {(detections || []).map((d, i) => {
              const [x1, y1, x2, y2] = d.coords;
              const x = x1 * display.scale;
              const y = y1 * display.scale;
              const w = (x2 - x1) * display.scale;
              const h = (y2 - y1) * display.scale;
              const label = d.label || "Plant";
              const conf = d.confidence != null ? ` ${(d.confidence * 100).toFixed(0)}%` : "";
              return (
                <g key={i}>
                  <rect x={x} y={y} width={w} height={h} fill="none" stroke="lime" strokeWidth="2" />
                  <text x={x + 4} y={Math.max(y - 4, 14)} fontSize="14" fill="white">
                    {label}{conf}
                  </text>
                </g>
              );
            })}
          </svg>
        </>
      )}
    </div>
  );
}
