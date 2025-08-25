import React, { useState } from "react";
import DetectionOverlay from "./components/DetectionOverlay";
import PlantTable from "./components/PlantTable";

const PREDICT_URL = "http://127.0.0.1:2021/predict"; // your Flask route

export default function PictureDetect() {
  const [file, setFile] = useState(null);
  const [imgURL, setImgURL] = useState("");
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [detections, setDetections] = useState([]); // raw objects from backend
  const [rows, setRows] = useState([]);             // editable rows
  const CONTAINERS = ["unknown", "Pot", "Raised_Bed", "ground"];


  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setImgURL(url);

    // probe natural size
    const probe = new Image();
    probe.onload = () => setNatural({ width: probe.naturalWidth, height: probe.naturalHeight });
    probe.src = url;

    // clear previous detections
    setDetections([]);
    setRows([]);
  }
  function renumberRows() {
    setRows(prev => prev.map((r, i) => ({ ...r, idx: i + 1 })));
  }
  async function runDetect() {
    if (!file) return;
    const fd = new FormData();
    fd.append("image", file);

    const res = await fetch(PREDICT_URL, { method: "POST", body: fd });
    if (!res.ok) {
      console.error("Detect failed", res.status);
      return;
    }
    const data = await res.json();
    const arr = Array.isArray(data.image) ? data.image : [];
    setDetections(arr);
    
    setRows(
      arr.map((d, i) => ({
        idx: i + 1,
        label: d.label || "Plant",
        confidence: d.confidence ?? null,
        coords: d.coords,
        image: d.image,
        container: d.container ?? "unknown",
        notes: ""
      }))
    );

  }

  return (
    <div style={{ padding: 16 }}>
      <h2>YOLO Detection (React + SVG)</h2>

      <input type="file" accept="image/*" onChange={onFileChange} />
      <button onClick={runDetect} disabled={!file} style={{ marginLeft: 8 }}>
        Detect
      </button>

      <div style={{ marginTop: 12 }}>
        <DetectionOverlay
          src={imgURL}
          natural={natural}
          detections={rows}     
          maxWidth={720}
        />
      </div>

      {rows.length > 0 && (
        <PlantTable rows={rows} setRows={setRows} containerOptions={CONTAINERS} />
      )}
    </div>
  );
}
