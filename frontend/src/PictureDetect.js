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
const CONTAINERS = ["unknown", "pot", "raised_bed", "ground"];
  

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

  async function runDetect() {
    if (!file) return;
    const fd = new FormData();
    fd.append("image", file); // <-- key must match Flask: request.files["image"]

    const res = await fetch(PREDICT_URL, { method: "POST", body: fd });
    if (!res.ok) {
      console.error("Detect failed", res.status);
      return;
    }
    const data = await res.json();
    const arr = Array.isArray(data.image) ? data.image : []; // adapt to your shape
    setDetections(arr);
    // seed rows from detections
    setRows(arr.map(d => ({
    label: d.label || "Plant",
    confidence: d.confidence ?? null,
    coords: d.coords,
    image: d.image,
    container: d.container ?? "unknown",   // from backend only
    notes: ""
    })));
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>YOLO Detection (React + SVG)</h2>

      <input type="file" accept="image/*" onChange={onFileChange} />
      <button onClick={runDetect} disabled={!file} style={{ marginLeft: 8 }}>
        Detect
      </button>

      <div style={{ marginTop: 12 }}>
        <DetectionOverlay src={imgURL} natural={natural} detections={detections} maxWidth={720} />
      </div>

      {rows.length > 0 && (
        <PlantTable rows={rows} setRows={setRows} containerOptions={CONTAINERS}/>
      )}
    </div>
  );
}
