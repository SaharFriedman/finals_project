import React, { useEffect, useRef, useState } from "react";

/**
 * BBoxPicker - overlays a canvas on top of the displayed <img> so the user can
 * click and drag a rectangle. It returns coordsPx in ORIGINAL pixels: [x, y, w, h].
 *
 * Props:
 * - imgRef: React ref to the <img> element
 * - onConfirm(coordsPx: [x, y, w, h])
 * - onCancel()
 * - initial (optional): { x, y, w, h } in displayed pixels to seed the box
 */
export default function BBoxPicker({ imgRef, onConfirm, onCancel, initial }) {
  const canvasRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [rect, setRect] = useState(initial || null);

  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const { width, height } = img.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    draw();
    // redraw on resize could be added if your layout changes dynamically
    // but this minimal version sizes on mount + rect change
  });

  function localPos(e) {
    const r = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
    const y = Math.max(0, Math.min(r.height, e.clientY - r.top));
    return { x, y };
  }

  function start(e) {
    const p = localPos(e);
    setDrag(p);
    setRect(null);
  }
  function move(e) {
    if (!drag) return;
    const p = localPos(e);
    const x = Math.min(drag.x, p.x);
    const y = Math.min(drag.y, p.y);
    const w = Math.abs(p.x - drag.x);
    const h = Math.abs(p.y - drag.y);
    setRect({ x, y, w, h });
  }
  function end() {
    setDrag(null);
  }

  function draw() {
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    // dim everything
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(0, 0, c.width, c.height);
    if (rect) {
      // clear the selected box area to highlight it
      ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
      // outline
      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
  }

  useEffect(() => {
    draw();
  });

  function confirm() {
    const img = imgRef.current;
    const c = canvasRef.current;
    if (!img || !rect) return;

    // map from displayed pixels to original pixels
    const scaleX = img.naturalWidth / c.width;
    const scaleY = img.naturalHeight / c.height;
    const coordsPx = [
      Math.round(rect.x * scaleX),
      Math.round(rect.y * scaleY),
      Math.round(rect.w * scaleX),
      Math.round(rect.h * scaleY),
    ];
    onConfirm(coordsPx);
  }

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.05)"
    }}>
      <canvas
        ref={canvasRef}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        style={{ display: "block", cursor: "crosshair" }}
      />
      <div style={{ position: "absolute", bottom: 10, display: "flex", gap: 8 }}>
        <button onClick={confirm} disabled={!rect}>OK</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
