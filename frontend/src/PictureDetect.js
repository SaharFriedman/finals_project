import React, { useEffect, useState } from "react";
import DetectionOverlay from "./components/DetectionOverlay";
import PlantTable from "./components/PlantTable";
import { savePhotoFile } from "./api/photos";
import { listAreas, createArea, renameArea } from "./api/areas";
import { bulkUpsertPlants } from "./api/plants";
import SignOutButton from "./components/SignOutButton";
import axios from "axios";
const PREDICT_URL = "http://127.0.0.1:2021/predict";            // Flask YOLO
const API_BASE = "http://localhost:12345/api";   // Node MVC

export default function PictureDetect() {
  // Auth/user — replace with your real user id once auth is wired
  const [userId] = useState("66cc66cc66cc66cc66cc66cc");

  // Areas
  const [areas, setAreas] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState("");

  // Image/detection
  const [file, setFile] = useState(null);
  const [imgURL, setImgURL] = useState("");
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [rows, setRows] = useState([]); // table rows (what you draw and save)

  // Saved photo info (after upload)
  const [photoMeta, setPhotoMeta] = useState(null); // { photo_id, photo_url, slot }

  // Container options for table dropdown
  const CONTAINERS = ["unknown", "Pot", "Raised_Bed", "ground"];

  // Load user's areas on mount
  useEffect(() => {
    (async () => {
      try {
        const a = await listAreas(userId);
        setAreas(a);
        if (a.length) setSelectedAreaId(a[0].area_id);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [userId]);

  async function onAddArea() {
  try {
    const a = await createArea();

    setAreas(prev => [...prev, a].sort((x, y) => {
      const ox = x.orderIndex ?? Number.MAX_SAFE_INTEGER;
      const oy = y.orderIndex ?? Number.MAX_SAFE_INTEGER;
      return ox - oy || String(x.name).localeCompare(String(y.name));
    }));

    setSelectedAreaId(a.area_id); 
  } catch (e) {
    console.error(e);
    alert("Failed to create area");
  }
}

  async function onRenameArea() {
    if (!selectedAreaId) return;
    const name = prompt("New area name (e.g., Front yard):");
    if (!name) return;
    try {
      const updated = await renameArea(selectedAreaId, name);
      setAreas(prev => prev.map(x => x.area_id === updated.area_id ? updated : x));
    } catch (e) {
      console.error(e);
      alert("Rename failed");
    }
  }

  const handleFileChange = (e) => {
    const f = e.target.files?.[0] || null;
    if (!f) return;
    setFile(f);

    const url = URL.createObjectURL(f);
    setImgURL(url);
    const probe = new Image();
    probe.onload = () => setNatural({ width: probe.naturalWidth, height: probe.naturalHeight });
    probe.src = url;

    setRows([]);
    setPhotoMeta(null);
  }

  async function runDetect() {
    if (!file) return alert("Choose a photo first.");
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch(PREDICT_URL, { method: "POST", body: fd });
    if (!res.ok) {
      console.error("Detect failed", res.status);
      return alert("Detect failed");
    }
    const data = await res.json();
    const arr = Array.isArray(data.image) ? data.image : [];

    setRows(arr.map((d, i) => ({
      idx: i + 1,
      label: d.label || "Plant",
      confidence: typeof d.confidence === "number" ? d.confidence : null,
      coords: d.coords,                        // [x1,y1,x2,y2] pixels
      container: d.container ?? "unknown",
      notes: "",
    })));
  }

  async function handleSavePhotoAndPlants() {
    try {
      if (!selectedAreaId) return alert("Select or add an area first.");
      if (!file) return alert("Choose a photo first.");
      if (!rows.length) return alert("No plants to save.");

      const takenAt = new Date().toISOString();
      const { photo_id, photo_url, slot } = await savePhotoFile({
        file, userId, areaId: selectedAreaId, takenAt, apiBase: API_BASE
      });
      setPhotoMeta({ photo_id, photo_url, slot });

      const payload = rows.map(r => ({
        area_id: selectedAreaId,
        photo_id,
        idx: r.idx,
        label: r.label || "Plant",
        container: r.container || "unknown",
        coords_px: r.coords,
        confidence: typeof r.confidence === "number" ? r.confidence : 0,
        notes: r.notes || "",
      }));

      const token = localStorage.getItem("token");
      const res = await axios.post("http://localhost:12345/api/plants", payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      alert(`Saved! (Photo slot ${slot})`);
    } catch (e) {
      console.error(e);
      alert(e.message || "Save failed");
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>YOLO Detection (React + SVG)</h2>
      <SignOutButton />

      {/* Area controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <select
          value={selectedAreaId}
          onChange={(e) => setSelectedAreaId(e.target.value)}
        >
          <option value="" disabled>Select area…</option>
          {areas.map(a => (
            <option key={a.area_id} value={a.area_id}>{a.name}</option>
          ))}
        </select>
        <button onClick={onAddArea}>+ Add Area</button>
        <button onClick={onRenameArea} disabled={!selectedAreaId}>Rename</button>
      </div>

      {/* File + detect */}
      <input type="file" accept="image/*" onChange={handleFileChange} />
      <button onClick={runDetect} disabled={!file} style={{ marginLeft: 8 }}>
        Detect
      </button>

      {/* Image + overlay */}
      <div style={{ marginTop: 12 }}>
        <DetectionOverlay
          src={imgURL}
          natural={natural}
          detections={rows}    // draw what the table has (keeps edits in sync)
          maxWidth={720}
        />
      </div>

      {/* Table + Save */}
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

      {/* Show saved photo (from server) */}
      {photoMeta?.photo_url && (
        <div style={{ marginTop: 16 }}>
          <p>Saved photo (slot {photoMeta.slot}):</p>
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
