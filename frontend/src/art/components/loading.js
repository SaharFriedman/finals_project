import React, { useEffect, useRef } from "react";

export default function Loading({ text = "Loading..." }) {
  const canvasRef = useRef(null);
  const rafRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    let mult = 2;
    const N = 200;

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h); // transparent clear

      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.5 * 0.6; // 60vmin
      const pts = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
      }

      ctx.strokeStyle = "#2ee86c";
      ctx.fillStyle = "#2ee86c";
      ctx.lineWidth = 1;

      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const j = Math.floor((mult * i) % N);
        ctx.moveTo(...pts[i]);
        ctx.lineTo(...pts[j]);
      }
      ctx.stroke();

      for (let [x, y] of pts) {
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      mult += 0.01;
      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="loading-overlay">
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      <h1 className="loading-text">{text}</h1>
    </div>
  );
}
