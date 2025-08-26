import React, { useState } from "react";
import DetectionOverlay from "./components/DetectionOverlay";
import PlantTable from "./components/PlantTable";
import { savePhotoFile } from "./api/photos"; 

const PREDICT_URL = "http://127.0.0.1:2021/predict";
const API_BASE = "http://localhost:12345/api"; 

export default function PictureDetect() {
  const [file, setFile] = useState(null);
  const [imgURL, setImgURL] = useState("");
  const [natural, setNatural] = useState({ width: 0, height: 0 });

  const [detections, setDetections] = useState([]);
  const [rows, setRows] = useState([]);             

  const [areaId, setAreaId] = useState("66cc66cc66cc66cc66cc66cc");

  const [photoMeta, setPhotoMeta] = useState(null); 

  const CONTAINERS = ["unknown", "Pot", "Raised_Bed", "ground"];

  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    const url = URL.createObjectURL(f);
    setImgURL(url);

    // probe natural size so overlay draws in correct pixel space
    const probe = new Image();
    probe.onload = () =>
      setNatural({ width: probe.naturalWidth, height: probe.naturalHeight });
    probe.src = url;

    // clear previous state
    setDetections([]);
    setRows([]);
    setPhotoMeta(null);
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
        confidence: typeof d.confidence === "number" ? d.confidence : null,
        coords: d.coords,                           
        image: d.image,                             
        container: d.container ?? "unknown",
        notes: "",
      }))
    );
  }

  async function handleSavePhotoAndPlants() {
    try {
      if (!file) {
        alert("Choose a photo first.");
        return;
      }
      if (!rows || rows.length === 0) {
        alert("No plants to save.");
        return;
      }

      const takenAt = new Date().toISOString();
      const { photo_id, photo_url } = await savePhotoFile({
        file,
        areaId,
        takenAt,
        apiBase: API_BASE,
      });
      setPhotoMeta({ photo_id, photo_url });

      const payload = rows.map((r) => ({
        area_id: areaId,
        photo_id,
        idx: r.idx,
        label: r.label || "Plant",
        container: r.container || "unknown",
        coords_px: r.coords, 
        confidence: typeof r.confidence === "number" ? r.confidence : 0,
        notes: r.notes || "",
      }));

      const resp = await fetch(`${API_BASE}/plants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(`Failed to save plants (${resp.status}): ${txt}`);
      }

      const mapping = await resp.json();
      console.log("Saved:", { photo_id, photo_url, mapping });
      alert("Photo and plants saved!");
    } catch (err) {
      console.error(err);
      alert(err.message || "Save failed");
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>YOLO Detection (React + SVG)</h2>

      <div style={{ marginBottom: 8 }}>
        <label>
          Area ID:&nbsp;
          <input
            style={{ width: 320 }}
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            placeholder="Mongo ObjectId of area"
          />
        </label>
      </div>

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
        <>
          <PlantTable rows={rows} setRows={setRows} containerOptions={CONTAINERS} />
          <div style={{ marginTop: 12 }}>
            <button onClick={handleSavePhotoAndPlants}>
              Save Photo + Plants
            </button>
          </div>
        </>
      )}

      {photoMeta?.photo_url && (
        <div style={{ marginTop: 16 }}>
          <p>Saved photo (from server):</p>
          <img
            src={`http://localhost:12345${photoMeta.photo_url}`}
            alt="Saved garden"
            style={{ maxWidth: 480, border: "1px solid #ddd" }}
          />
        </div>
      )}
    </div>
  );
}
