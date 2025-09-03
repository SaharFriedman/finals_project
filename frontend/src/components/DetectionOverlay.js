import React from "react";
export default function DetectionOverlay({ src, natural, detections, maxWidth = 720 }) {
  const [display, setDisplay] = React.useState({ width: 0, height: 0, scale: 1 });

  React.useEffect(() => {
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
            {(detections || []).map((d) => {
              const [x1, y1, x2, y2] = d.coords;
              const x = x1 * display.scale;
              const y = y1 * display.scale;
              const w = (x2 - x1) * display.scale;
              const h = (y2 - y1) * display.scale;
              const idx = d.idx ?? "?";

              return (
                <g key={idx}>
                  {/* box */}
                  <rect x={x} y={y} width={w} height={h} fill="none" stroke="lime" strokeWidth="2" />

                  {/* number badge (small rounded rect) */}
                  <rect x={x} y={Math.max(y - 18, 0)} width="22" height="18" rx="4" ry="4" fill="rgba(0,0,0,0.6)" />
                  <text
                    x={x + 11}
                    y={Math.max(y - 4, 12)}
                    textAnchor="middle"
                    fontSize="12"
                    fill="white"
                    fontFamily="system-ui, sans-serif"
                  >
                    {idx}
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