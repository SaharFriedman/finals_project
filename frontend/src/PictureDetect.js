import React, { useEffect, useState } from "react";
import DetectionOverlay from "./components/DetectionOverlay";
import PlantTable from "./components/PlantTable";
import { savePhotoFile, listAreaPhotos } from "./api/photos";
import { listAreas, createArea, renameArea } from "./api/areas";
import { bulkUpsertPlants, listAreaPlants } from "./api/plants";
import SignOutButton from "./components/SignOutButton";
import axios from "axios";
const PREDICT_URL = "http://127.0.0.1:2021/predict";            // Flask YOLO
const API_BASE = "http://localhost:12345/api";   // Node MVC

export default function PictureDetect() {
  const [userId] = useState("");
  const [savedPhotos, setSavedPhotos] = useState([]);
  const [savedPlants, setSavedPlants] = useState([]);
  // Areas
  const [areas, setAreas] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState("");
  function normalizeAreas(list) {
    return (list || [])
      .map((x, i) => ({
        area_id: x.area_id || x._id || x.id || x.areaId || null,
        name: x.name || x.area_name || `area${i + 1}`,
        orderIndex: x.orderIndex ?? Number.MAX_SAFE_INTEGER,
      }))
      .filter(x => !!x.area_id);
  }
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
        const a = await listAreas(); // uses token - do not pass userId here
        const norm = normalizeAreas(a);
        setAreas(norm);
        if (norm.length) setSelectedAreaId(norm[0].area_id);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);
  useEffect(() => {
    if (!selectedAreaId || String(selectedAreaId).length < 8) {
      setSavedPhotos([]);
      setSavedPlants([]);
      return;
    }
    (async () => {
      try {
        const [photos, plants] = await Promise.all([
          listAreaPhotos(selectedAreaId),
          listAreaPlants(selectedAreaId),
        ]);
        setSavedPhotos(photos);
        setSavedPlants(plants);
      } catch (e) {
        console.error("load saved for area failed", e);
      }
    })();
  }, [selectedAreaId]);

  async function onAddArea() {
    try {
      const raw = await createArea();              // backend returns { _id, name }
      const a = normalizeAreas([raw])[0];          // make sure it has area_id

      setAreas(prev => [...prev, a].sort((x, y) =>
        (x.orderIndex - y.orderIndex) || String(x.name).localeCompare(String(y.name))
      ));
      setSelectedAreaId(a.area_id);                // use normalized id only
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
        file,
        areaId: selectedAreaId,
        takenAt,
      });
      setPhotoMeta({ photo_id, photo_url, slot });

      const payload = rows.map(r => ({
        area_id: selectedAreaId,
        photo_id,
        idx: r.idx,
        label: r.label || "Plant",
        container: r.container || "unknown",
        coordsPx: r.coords,
        confidence: typeof r.confidence === "number" ? r.confidence : 0,
        notes: r.notes || "",
      }));
      await bulkUpsertPlants(payload);
      const token = localStorage.getItem("token");
      const res = await axios.post("http://localhost:12345/api/plants", payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      alert(`Saved! (Photo slot ${slot})`);
      try {
        const [photos, plants] = await Promise.all([
          listAreaPhotos(selectedAreaId),
          listAreaPlants(selectedAreaId),
        ]);
        setSavedPhotos(photos);
        setSavedPlants(plants);
      } catch (e) {
        console.error("refresh after save failed", e);
      }
    } catch (e) {
      console.error(e);
      alert(e.message || "Save failed");
    }
  }
  const plantsByPhoto = React.useMemo(() => {
    const m = new Map();
    for (const p of savedPlants) {
      const arr = m.get(p.photo_id) || [];
      arr.push({
        coords: p.coords,          // [x1,y1,x2,y2] in px
        label: p.label,
        confidence: p.confidence,
        notes: p.notes || "",
        idx: p.idx,
      });
      m.set(p.photo_id, arr);
    }
    return m;
  }, [savedPlants]);

  return (
    <div style={{ padding: 16 }}>
      <h2>YOLO Detection (React + SVG)</h2>
      <SignOutButton />

      {/* Area controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <select
          value={selectedAreaId || ""}
          onChange={(e) => setSelectedAreaId(e.target.value)}
        >
          <option key="__placeholder__" value="" disabled>Select area…</option>
          {areas.map(a => {
            const id = a.area_id || a._id || a.id || a.areaId; // belt-and-suspenders
            return (
              <option key={String(id)} value={String(id)}>
                {a.name}
              </option>
            );
          })}
        </select>
        <button onClick={onAddArea}>+ Add Area</button>
        <button onClick={onRenameArea} disabled={!selectedAreaId}>Rename</button>
      </div>

      {/* Saved photos for this area with overlays */}
      {savedPhotos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginBottom: 12 }}>
          {savedPhotos.map(p => (
            <div key={p.photo_id} style={{ border: '1px solid #ddd', padding: 8, borderRadius: 8 }}>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                Photo slot {p.slot} - taken {new Date(p.takenAt).toLocaleString()}
              </div>
              <DetectionOverlay
                src={`http://localhost:12345${p.photo_url}`}
                natural={{ width: p.width, height: p.height }}
                detections={plantsByPhoto.get(p.photo_id) || []}
                maxWidth={480}
              />
            </div>
          ))}
        </div>
      )}

      {/* Saved plants for this area */}
      {savedPlants.length > 0 && (
        <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", marginBottom: 16 }}>
          <thead>
            <tr>
              <th>Photo slot</th>
              <th>#</th>
              <th>Label</th>
              <th>Container</th>
              <th>Confidence</th>
              <th>Coords [px]</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {savedPlants.map(r => {
              const photo = savedPhotos.find(p => p.photo_id === r.photo_id);
              return (
                <tr key={r.plant_id}>
                  <td>{photo ? photo.slot : ''}</td>
                  <td>{r.idx}</td>
                  <td>{r.label}</td>
                  <td>{r.container}</td>
                  <td>{typeof r.confidence === 'number' ? Math.round(r.confidence * 100) + '%' : ''}</td>
                  <td><code>{JSON.stringify(r.coords)}</code></td>
                  <td>{r.notes || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

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
