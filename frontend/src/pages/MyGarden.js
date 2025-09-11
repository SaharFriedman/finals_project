import React, { useEffect, useState } from "react";
import DetectionOverlay from "../components/DetectionOverlay";
import PlantTable from "../components/PlantTable";
import { savePhotoFile, listAreaPhotos,deletePhoto } from "../api/photos";
import { listAreas, createArea, renameArea,deleteArea } from "../api/areas";
import { listAreaPlants, deletePlant } from "../api/plants";
import SignOutButton from "../components/SignOutButton";
import { useMemo, useRef } from "react";
import BBoxPicker from "../components/BBoxPicker";
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
  const [savedNew, setSavedNew] = useState(null);      // { photo, idx, label, container, coords, ... }
  const [pickerSavedOpen, setPickerSavedOpen] = useState(false);
  const savedImgRef = useRef(null);
  const [newRow, setNewRow] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const imgPickRef = useRef(null);

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

  /*this is all the functions required to activate a new plant and bbox picker for it*/
  // next idx inside the current rows table
  const nextIdx = useMemo(() => {
    const maxInRows = rows.reduce((m, r) => Math.max(m, Number(r.idx || 0)), 0);
    return maxInRows + 1;
  }, [rows]);

  function onAddNewPlant() {
    if (!file || !imgURL) {
      // need to refactor
      alert("Choose a photo first.");
      return;
    }
    setNewRow({
      idx: nextIdx,
      label: "",
      container: "unknown",
      coords: null,              // will be set by bbox picker
      confidence: 1,
      notes: "",
      lastWateredAt: null,
      lastFertilizedAt: null,
      plantedMonth: null,
      plantedYear: null,
    });
  }

  function onPickCoords() {
    if (!imgURL) {
      alert("No image loaded.");
      return;
    }
    setPickerOpen(true);
  }

  function onCoordsPicked(coordsPx) {
    // picker returns [x,y,w,h] in original pixels - convert to [x1,y1,x2,y2]
    const xyxy = xywhToXyxy(coordsPx);
    setNewRow(prev => ({ ...prev, coords: xyxy }));
    setPickerOpen(false);
  }

  function onSaveNewRow() {
    if (!newRow?.label?.trim()) return alert("Label is required.");
    if (!Array.isArray(newRow?.coords)) return alert("Please pick coordinates on the photo.");
    setRows(prev => [...prev, { ...newRow }]);
    setNewRow(null);
  }

  function onCancelNewRow() {
    setNewRow(null);
    setPickerOpen(false);
  }

  /**************************** this is the end for helpers***************************************************/

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
  // this function handles a deletion of a new area
async function onDeleteArea() {
  if (!selectedAreaId) return;

  try {
    // delete photos and plants by selectedArea
    const [photos, plants] = await Promise.all([
      listAreaPhotos(selectedAreaId).catch(() => []),
      listAreaPlants(selectedAreaId).catch(() => []),
    ]);

    // delete plants
    await Promise.allSettled(plants.map(p => deletePlant(p.plant_id)));

    // delete photos
    await Promise.allSettled(photos.map(ph => deletePhoto(ph.photo_id)));

    // finally delete the area itself
    await deleteArea(selectedAreaId); 
    // update UI state
    const remaining = areas.filter(a => a.area_id !== selectedAreaId);
    setAreas(remaining);
    setSelectedAreaId(remaining[0]?.area_id || "");
    setSavedPhotos([]);
    setSavedPlants([]);
    setRows([]);
    setFile(null);
    setImgURL("");
    setPhotoMeta(null);
  } catch (e) {
    console.error(e);
    alert(e.message || "Delete area failed");
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
  // to fix rendering from plant adding
  function xywhToXyxy(c) {
    if (!Array.isArray(c) || c.length !== 4) return null;
    const [x, y, w, h] = c.map(Number);
    return [x, y, x + Math.max(1, w), y + Math.max(1, h)];
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
      const c = p.coords ?? p.coordsPx ?? null;
      arr.push({
        coords: c,
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
        <button onClick={onDeleteArea} disabled={!selectedAreaId}>Delete</button>
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
              <button
                type="button"
                style={{ marginTop: 6 }}
                onClick={() => {
                  const maxIdx = Math.max(
                    0,
                    ...savedPlants.filter(sp => sp.photo_id === p.photo_id).map(sp => sp.idx || 0)
                  );
                  setSavedNew({
                    photo: p,
                    idx: maxIdx + 1,
                    label: "",
                    container: "unknown",
                    coords: null, // will be set by picker
                    confidence: 0.99,
                    notes: "",
                  });
                  setPickerSavedOpen(true);
                }}
              >
                Add plant
              </button>
              {/* Global picker modal for adding to any saved photo */}
              {pickerSavedOpen && savedNew?.photo && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.45)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 9999,
                    padding: 16,
                  }}
                  onClick={() => setPickerSavedOpen(false)} // click backdrop closes
                >
                  <div
                    style={{
                      position: "relative",
                      background: "#fff",
                      borderRadius: 8,
                      padding: 12,
                      maxWidth: "90vw",
                      maxHeight: "90vh",
                      overflow: "auto",
                    }}
                    onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
                  >
                    <div style={{ fontSize: 14, marginBottom: 8 }}>
                      Pick box - photo slot {savedNew.photo.slot}
                    </div>

                    <div style={{ position: "relative", display: "inline-block" }}>
                      <img
                        ref={savedImgRef}
                        src={`http://localhost:12345${savedNew.photo.photo_url}`}
                        alt=""
                        style={{ display: "block", maxWidth: "80vw", maxHeight: "70vh", width: "100%", height: "auto", border: "1px solid #eee" }}
                      />
                      <BBoxPicker
                        imgRef={savedImgRef}
                        onConfirm={(coordsPx) => {
                          // picker returns [x,y,w,h] - convert to [x1,y1,x2,y2] to match your overlay/storage
                          const [x, y, w, h] = coordsPx.map(Number);
                          const xyxy = [x, y, x + Math.max(1, w), y + Math.max(1, h)];
                          setSavedNew(prev => ({ ...prev, coords: xyxy }));
                          setPickerSavedOpen(false);
                        }}
                        onCancel={() => setPickerSavedOpen(false)}
                      />
                    </div>

                    <div style={{ marginTop: 10, textAlign: "right" }}>
                      <button onClick={() => setPickerSavedOpen(false)}>Close</button>
                    </div>
                  </div>
                </div>
              )}

              {savedNew?.photo?.photo_id === p.photo_id && (
                <div style={{ marginTop: 8, padding: 8, border: "1px solid #ddd", borderRadius: 6 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
                    <div>Idx</div><div>{savedNew.idx}</div>
                    <div>Label *</div>
                    <div>
                      <input
                        value={savedNew.label}
                        onChange={e => setSavedNew({ ...savedNew, label: e.target.value })}
                        placeholder="e.g., Tomato"
                      />
                    </div>
                    <div>Container</div>
                    <div>
                      <select
                        value={savedNew.container}
                        onChange={e => setSavedNew({ ...savedNew, container: e.target.value })}
                      >
                        {CONTAINERS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>Confidence</div>
                    <div>
                      <input
                        type="number" step="0.01" min="0" max="1"
                        value={savedNew.confidence}
                        onChange={e => setSavedNew({ ...savedNew, confidence: e.target.value })}
                      />
                    </div>
                    <div>Coords *</div>
                    <div>
                      <code>{savedNew.coords ? JSON.stringify(savedNew.coords) : "(pick on photo above)"}</code>
                    </div>
                    <div>Notes</div>
                    <div>
                      <input
                        value={savedNew.notes}
                        onChange={e => setSavedNew({ ...savedNew, notes: e.target.value })}
                        placeholder="optional notes"
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!savedNew.label.trim()) return alert("Label is required.");
                        if (!Array.isArray(savedNew.coords)) return alert("Pick coords on the photo.");
                        const token = localStorage.getItem("token");
                        const payload = [{
                          area_id: selectedAreaId,
                          photo_id: savedNew.photo.photo_id,
                          idx: savedNew.idx,
                          label: savedNew.label.trim(),
                          container: savedNew.container || "unknown",
                          coordsPx: savedNew.coords, // server expects pixels
                          confidence: Number(savedNew.confidence) || 0.99,
                          notes: savedNew.notes || "",
                          lastWateredAt: null,
                          lastFertilizedAt: null,
                          plantedMonth: null,
                          plantedYear: null,
                        }];
                        try {
                          await axios.post("http://localhost:12345/api/plants", payload, {
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
                          });
                          // refresh lists
                          const [photos2, plants2] = await Promise.all([
                            listAreaPhotos(selectedAreaId),
                            listAreaPlants(selectedAreaId),
                          ]);
                          setSavedPhotos(photos2);
                          setSavedPlants(plants2);
                          setSavedNew(null);
                        } catch (e) {
                          console.error(e);
                          alert(e.message || "Save failed");
                        }
                      }}
                    >
                      Save plant
                    </button>
                    <button type="button" onClick={() => { setSavedNew(null); setPickerSavedOpen(false); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

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
              <th>Watered</th>
              <th>Fertilized</th>
              <th>Planted</th>
              <th>Notes</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {/* Saved plants table */}
            {savedPlants.map(r => {
              const photo = savedPhotos.find(p => p.photo_id === r.photo_id);
              return (
                <tr key={r.plant_id}>
                  <td>{photo ? photo.slot : ''}</td>
                  <td>{r.idx}</td>
                  <td>{r.label}</td>
                  <td>{r.container}</td>
                  <td>{r.lastWateredAt ? new Date(r.lastWateredAt).toLocaleString() : ''}</td>
                  <td>{r.lastFertilizedAt ? new Date(r.lastFertilizedAt).toLocaleString() : ''}</td>
                  <td>{r.plantedMonth && r.plantedYear ? `${String(r.plantedMonth).padStart(2, '0')}/${r.plantedYear}` : ''}</td>
                  <td>{r.notes || ''}</td>
                  <td><button type="button" onClick={() => handleDeleteSavedPlant(r.plant_id)}> Delete</button></td>
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
      <button onClick={onAddNewPlant} disabled={!file} style={{ marginLeft: 8 }}>
        Add new plant
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
      {/* Manual box picker overlay over the same photo */}
      {pickerOpen && imgURL && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: 16,
    }}
    onClick={() => setPickerOpen(false)} // click backdrop to close
  >
    <div
      style={{
        position: "relative",
        background: "#fff",
        borderRadius: 8,
        padding: 12,
        maxWidth: "90vw",
        maxHeight: "90vh",
        overflow: "auto",
      }}
      onClick={(e) => e.stopPropagation()} // do not close when clicking inside
    >
      <div style={{ fontSize: 14, marginBottom: 8 }}>
        Pick box - current uploaded photo
      </div>

      <div style={{ position: "relative", display: "inline-block" }}>
        <img
          ref={imgPickRef}
          src={imgURL}
          alt=""
          style={{
            display: "block",
            maxWidth: "80vw",
            maxHeight: "70vh",
            width: "100%",
            height: "auto",
            border: "1px solid #eee",
          }}
        />
        <BBoxPicker
          imgRef={imgPickRef}
          onConfirm={onCoordsPicked}     // you already convert xywh -> xyxy inside this
          onCancel={() => setPickerOpen(false)}
        />
      </div>

      <div style={{ marginTop: 10, textAlign: "right" }}>
        <button onClick={() => setPickerOpen(false)}>Close</button>
      </div>
    </div>
  </div>
)}
      {newRow && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", maxWidth: 820 }}>
          <h3>Add a new plant</h3>
          <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td>Idx</td>
                <td>{newRow.idx}</td>
              </tr>
              <tr>
                <td>Label *</td>
                <td>
                  <input
                    value={newRow.label}
                    onChange={e => setNewRow({ ...newRow, label: e.target.value })}
                    placeholder="e.g., Tomato"
                  />
                </td>
              </tr>
              <tr>
                <td>Container</td>
                <td>
                  <select
                    value={newRow.container}
                    onChange={e => setNewRow({ ...newRow, container: e.target.value })}
                  >
                    {CONTAINERS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </td>
              </tr>
              <tr>
                <td>Confidence</td>
                <td>
                  <input
                    type="number" step="0.01" min="0" max="1"
                    value={newRow.confidence}
                    onChange={e => setNewRow({ ...newRow, confidence: e.target.value })}
                  />
                </td>
              </tr>
              <tr>
                <td>Coords *</td>
                <td>
                  <code>{newRow.coords ? JSON.stringify(newRow.coords) : "(pick on photo)"}</code>
                  <div style={{ marginTop: 6 }}>
                    <button type="button" onClick={onPickCoords}>Pick on photo</button>
                  </div>
                  <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                    Click and drag on the image to draw a rectangle. We store [x, y, w, h] in original pixels.
                  </div>
                </td>
              </tr>
              <tr>
                <td>Notes</td>
                <td>
                  <input
                    value={newRow.notes}
                    onChange={e => setNewRow({ ...newRow, notes: e.target.value })}
                    placeholder="optional notes"
                  />
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button type="button" onClick={onSaveNewRow}>Save to table</button>
            <button type="button" onClick={onCancelNewRow}>Cancel</button>
          </div>
        </div>
      )}

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
