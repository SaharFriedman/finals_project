import React, { useEffect, useState } from "react";
import DetectionOverlay from "../components/DetectionOverlay";
import PlantTable from "../components/PlantTable";
import { savePhotoFile, listAreaPhotos } from "../api/photos";
import { listAreas, createArea, renameArea } from "../api/areas";
import { listAreaPlants, deletePlant } from "../api/plants";
import SignOutButton from "../components/SignOutButton";
import axios from "axios";
const PREDICT_URL = "http://127.0.0.1:2021/predict";

export default function PictureDetect() {
  // getting all of the photos of the user
  const [savedPhotos, setSavedPhotos] = useState([]);
  // getting all of the plants of the user
  const [savedPlants, setSavedPlants] = useState([]);
  // getting all of the areas of the user
  const [areas, setAreas] = useState([]);
  // to find which area the user is currently looking at
  const [selectedAreaId, setSelectedAreaId] = useState("");
  // changing the name of the list to work with several methods of the API w.o relaying on the server 
  function normalizeAreas(list) {
    return (list || [])//map the list with area name and id
      .map((x, i) => ({
        area_id: x.area_id || x._id || x.id || x.areaId || null,
        name: x.name || x.area_name || `area${i + 1}`,
        orderIndex: x.orderIndex ?? Number.MAX_SAFE_INTEGER,
      }))
      .filter(x => !!x.area_id);// filter areas w.o an ID
  }
  const [file, setFile] = useState(null);
  const [imgURL, setImgURL] = useState("");
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  // rows of the table of plants
  const [rows, setRows] = useState([]);

  const [photoMeta, setPhotoMeta] = useState(null);

  const CONTAINERS = ["unknown", "Pot", "Raised_Bed", "ground"];
  // this useEffect is handling areas data
  useEffect(() => {
    (async () => {
      try {
        // a = list of all areas
        const a = await listAreas();
        // getting the ID's 
        const norm = normalizeAreas(a);
        // setting norm as the "areas" constant at default 
        setAreas(norm);
        // set first ID as the default selected area of the user as default
        if (norm.length) setSelectedAreaId(norm[0].area_id);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);
  // this useEffect is handling photo and plants data
  useEffect(() => {
    if (!selectedAreaId) {
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
  }, [selectedAreaId]);// do it whenever the selectedAreaId is changed(by the toggle bar)
  // this function handles an addition of a new area
  async function onAddArea() {
    try {
      // create the area, reformat it to match to the others and sort the array of area
      const raw = await createArea();
      const a = normalizeAreas([raw])[0];
      // update the handled array      
      setAreas(prev => [...prev, a].sort((x, y) =>
        (x.orderIndex - y.orderIndex) || String(x.name).localeCompare(String(y.name))
      ));
      // update it to be the selected area at the moment
      setSelectedAreaId(a.area_id);
    } catch (e) {
      console.error(e);
      alert("Failed to create area");
    }
  }
  // handle subbmision for a new area name to a selected area
  async function onRenameArea() {
    if (!selectedAreaId) return;
    // need to change the prompt to be nicer
    const name = prompt("New area name (e.g., Front yard):");
    if (!name) return;
    try {
      // rename the area
      const updated = await renameArea(selectedAreaId, name);
      /* update the array of areas represented to the user
         prev is the array that we currently have of areas in  
         setAreas and we map each x in the area and return the new array that is the result */
      setAreas(prev => prev.map(x => x.area_id === updated.area_id ? updated : x));
    } catch (e) {
      console.error(e);
      // refactor the alert!
      alert("Rename failed");
    }
  }

  // handling the image after inputing a file
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
  // handling to delete post saved plants
  async function handleDeleteSavedPlant(plantId) {
    try {
      await deletePlant(plantId);
      setSavedPlants(prev => prev.filter(p => p.plant_id !== plantId));
    } catch (e) {
      console.error(e);
      // refactor later
      alert(e.message || 'Delete failed');
    }
  }

  // this function handles the detection flow of the page  
  async function runDetect() {
    // refactor the alert!
    if (!file) return alert("Choose a photo first.");
    // run the prediction model of the python server
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch(PREDICT_URL, { method: "POST", body: fd });
    if (!res.ok) {
      console.error("Detect failed", res.status);
      return alert("Detect failed");
    }
    // recieve the data from the python server API
    const data = await res.json();
    const arr = Array.isArray(data) ? data : [];

    setRows(arr.map((d, i) => ({
      idx: i + 1,
      label: d.label || "Plant",
      confidence: typeof d.confidence === "number" ? d.confidence : null,
      coords: d.coords,
      container: d.container ?? "unknown",
      lastWateredAt: null,
      lastFertilizedAt: null,
      plantedMonth: null,
      plantedYear: null,
      notes: "",
    })));
  }

  async function handleSavePhotoAndPlants() {
    try {
      // verify that the user selected everything properly
      if (!selectedAreaId) return alert("Select or add an area first.");
      if (!file) return alert("Choose a photo first.");
      if (!rows.length) return alert("No plants to save.");
      // add a date to the 
      const takenAt = new Date().toISOString();
      const { photo_id, photo_url, slot } = await savePhotoFile({
        file,
        areaId: selectedAreaId,
        takenAt,
      });
      // updating the photo meta data 
      setPhotoMeta({ photo_id, photo_url, slot });

      const payload = rows.map(r => ({
        area_id: selectedAreaId,
        photo_id,
        idx: r.idx,
        label: r.label || "Plant",
        container: r.container || "unknown",
        coordsPx: r.coords,
        confidence: typeof r.confidence === "number" ? r.confidence : 0,
        lastWateredAt: r.lastWateredAt || null,
        lastFertilizedAt: r.lastFertilizedAt || null,
        plantedMonth: r.plantedMonth ?? null,
        plantedYear: r.plantedYear ?? null,
        notes: r.notes || "",
      }));
      // upload the table to the server and save it in the plants DB
      const token = localStorage.getItem("token");
      await axios.post("http://localhost:12345/api/plants", payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      // refactor alert!
      alert(`Saved! (Photo slot ${slot})`);
      try {
        const [photos, plants] = await Promise.all([
          listAreaPhotos(selectedAreaId),
          listAreaPlants(selectedAreaId),
        ]);
        // save photos and plants
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
  // compute the plants that are saved and return with some parameters only when savedplants are changed
  const plantsByPhoto = React.useMemo(() => {
    const m = new Map();
    for (const p of savedPlants) {
      const arr = m.get(p.photo_id) || [];
      arr.push({
        coords: p.coords,
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
            const id = a.area_id || a._id || a.id || a.areaId;
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
              <th>Watered</th>
              <th>Fertilized</th>
              <th>Planted</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {/* Saved plants rendering */}
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
                  <td>{r.lastWateredAt ? new Date(r.lastWateredAt).toLocaleString() : ''}</td>
                  <td>{r.lastFertilizedAt ? new Date(r.lastFertilizedAt).toLocaleString() : ''}</td>
                  <td>{r.plantedMonth && r.plantedYear ? `${String(r.plantedMonth).padStart(2, '0')}/${r.plantedYear}` : ''}</td>
                  <td><button type="button" onClick={() => handleDeleteSavedPlant(r.plant_id)}> Delete</button></td>
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
          detections={rows}
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
