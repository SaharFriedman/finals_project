import React, { useEffect, useState } from "react";
import DetectionOverlay from "../components/DetectionOverlay";
import PlantTable from "../components/PlantTable";
import { savePhotoFile, listAreaPhotos, deletePhoto } from "../api/photos";
import { listAreas, createArea, renameArea, deleteArea } from "../api/areas";
import { listAreaPlants, deletePlant } from "../api/plants";
import { useRef } from "react";
import BBoxPicker from "../components/BBoxPicker";
import axios from "axios";
import Background from "../art/components/Background.js"
import TopBar from "../art/components/topbar.js";
import CustomFileUpload from "../art/components/CustomFileUpload.js";
import SelectAreaDropdown from "../art/components/SelectAreaDropdown";
import Loading from "../art/components/loading.js";
const PREDICT_URL = "http://127.0.0.1:2021/predict";

export default function PictureDetect() {
  const [loading, setLoading] = useState(true);
  // getting all of the photos of the user
  const [savedPhotos, setSavedPhotos] = useState([]);
  // getting all of the plants of the user
  const [savedPlants, setSavedPlants] = useState([]);
  // getting all of the areas of the user
  const [areas, setAreas] = useState([]);
  // to find which area the user is currently looking at
  const [selectedAreaId, setSelectedAreaId] = useState("");
  // staging object for adding a new plant into an already saved photo
  const [savedNew, setSavedNew] = useState(null);
  // controls the model that lets the user draw a box on a saved photo
  const [pickerSavedOpen, setPickerSavedOpen] = useState(false);
  // DOM ref for the saved-photo image inside the picker modal
  const savedImgRef = useRef(null);
  // staging row for adding a new detection to the current unsaved upload
  const [newRow, setNewRow] = useState(null);
  // controls the picker over the currently uploaded but unsaved image
  const [pickerOpen, setPickerOpen] = useState(false);
  // DOM ref for the uploaded image used by the on-page picker
  const imgPickRef = useRef(null);
  // file input element so you can clear it programmatically after save or reset
  const fileInputRef = useRef(null);
  // shows detection spinner while the Python server is processing
  const [detecting, setDetecting] = useState(false);
  // human friendly status message after detection completes or fails
  const [detectMessage, setDetectMessage] = useState("");

  function resetUploadState() {
    // revoke old blob url
    if (imgURL) URL.revokeObjectURL(imgURL);
    setImgURL("");
    setNatural({ width: 0, height: 0 });
    setFile(null);
    setRows([]);
    setNewRow(null);
    setPickerOpen(false);
    setPickerSavedOpen(false);
    setSavedNew(null);
    // clear the actual file input so same-file selection will trigger onChange
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function waterAllToday() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      // run all updates in parallel
      await Promise.all(
        savedPlants.map((p) =>
          updatePlantDates(p.plant_id, { lastWateredAt: today })
        )
      );
      // refresh after done
      const plants = await listAreaPlants(selectedAreaId);
      setSavedPlants(plants);
    } catch (err) {
      console.error("Failed to water all:", err);
    }
  }
  async function fertilizedAllToday() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      // run all updates in parallel
      await Promise.all(
        savedPlants.map((p) =>
          updatePlantDates(p.plant_id, { lastFertilizedAt: today })
        )
      );
      // refresh after done
      const plants = await listAreaPlants(selectedAreaId);
      setSavedPlants(plants);
    } catch (err) {
      console.error("Failed to water all:", err);
    }
  }
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


  const CONTAINERS = ["unknown", "Pot", "Raised_Bed", "ground"];

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
  async function updatePlantDates(plantId, patch) {
    const token = localStorage.getItem("token");
    const res = await axios.patch(
      `http://localhost:12345/api/plants/${plantId}`,
      patch,
      { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } }
    );
    return res.data;
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
    // clear previous area’s UI immediately
    setSavedNew(null);
    setPickerSavedOpen(false);
    setPickerOpen(false);
    setNewRow(null);
    setRows([]);

    // revoke old object URL and clear file/image
    setFile(null);
    setNatural({ width: 0, height: 0 });
    if (imgURL) URL.revokeObjectURL(imgURL);
    setImgURL("");

    // empty lists until the new fetch completes
    resetUploadState();
    setSavedPhotos([]);
    setSavedPlants([]);

    if (!selectedAreaId) return;

    let alive = true; // guard against race conditions

    (async () => {
      try {
        const [photos, plants] = await Promise.all([
          listAreaPhotos(selectedAreaId),
          listAreaPlants(selectedAreaId),
        ]);
        if (!alive) return; // ignore late responses from a previous area
        setSavedPhotos(photos);
        setSavedPlants(plants);
      } catch (e) {
        if (!alive) return;
        console.error("load saved for area failed", e);
      }
    })();

    return () => { alive = false; }; // cancel this run on area change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAreaId]);



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
      resetUploadState();
      setSavedPlants([]);
      setRows([]);
      setFile(null);
      setImgURL("");
    } catch (e) {
      console.error(e);
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
    }
  }

  // handling the image after inputing a file
  const handleFileChange = (file) => {
    const f = file || null;
    if (!f) return;

    if (imgURL) URL.revokeObjectURL(imgURL); // revoke old blob

    setFile(f);
    const url = URL.createObjectURL(f);
    setImgURL(url);

    const probe = new Image();
    probe.onload = () => setNatural({ width: probe.naturalWidth, height: probe.naturalHeight });
    probe.src = url;

    setRows([]);
  };

  // handling to delete post saved plants
  async function handleDeleteSavedPlant(plantId) {
    try {
      await deletePlant(plantId);
      setSavedPlants(prev => prev.filter(p => p.plant_id !== plantId));
    } catch (e) {
      console.error(e);
      // refactor later
      alert("different name required");
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
    if (!file) return;
    // run the prediction model of the python server
    setDetecting(true);            // show loading
    setDetectMessage("");          // clear old messages
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch(PREDICT_URL, { method: "POST", body: fd });
    if (!res.ok) {
      setDetectMessage("Detection failed. Please try again.");
    }
    // recieve the data from the python server API
    const data = await res.json();
    const arr = Array.isArray(data) ? data : [];
    if (arr.length === 0) {
      setDetectMessage("No plants were found in this photo.");
    }
    setRows(arr.map((d, i) => ({
      idx: i + 1,
      label: d.label || "Plant",
      species_label: d.species_label || "unknown",
      confidence: typeof d.confidence === "number" ? d.confidence : null,
      coords: d.coords,
      container: d.container ?? "unknown",
      lastWateredAt: null,
      lastFertilizedAt: null,
      plantedMonth: null,
      plantedYear: null,
      notes: "",
    })));
    setDetecting(false);
  }

  async function handleSavePhotoAndPlants() {
    try {
      // verify that the user selected everything properly
      if (!selectedAreaId) return alert("Select or add an area first.");
      if (!file) return alert("Choose a photo first.");
      if (!rows.length) return alert("No plants to save.");
      // add a date to the 
      const takenAt = new Date().toISOString();
      const { photo_id } = await savePhotoFile({
        file,
        areaId: selectedAreaId,
        takenAt,
      });
      // updating the photo meta data 
      const payload = rows.map(r => ({
        area_id: selectedAreaId,
        photo_id,
        idx: r.idx,
        label: r.label || "Plant",
        container: r.container || "unknown",
        species_label: r.species_label || "unknown",
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
      try {
        const [photos, plants] = await Promise.all([
          listAreaPhotos(selectedAreaId),
          listAreaPlants(selectedAreaId),
        ]);
        // save photos and plants
        setSavedPhotos(photos);
        setSavedPlants(plants);
        if (imgURL) URL.revokeObjectURL(imgURL);
        setFile(null);
        setImgURL("");
        setRows([]);
        setNewRow(null);
        setPickerOpen(false);
        setNatural({ width: 0, height: 0 });
      } catch (e) {
        console.error("refresh after save failed", e);
      }
    } catch (e) {
      console.error(e);
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
    <div style={{ height: "100vh", width: "100vw" }}>
      <Background onReady={() => setLoading(false)} />
      {loading && <Loading text="Fetching your garden plan..." />}
      <div style={{ position: "fixed", height: "100vh", width: "100vw", overflowY: "auto", paddingBottom: "50px" }}>
        <TopBar
          btn1={
            <SelectAreaDropdown
              areas={areas}
              value={selectedAreaId || ""}
              onChange={(id) => setSelectedAreaId(id)}
              placeholder="Select area…"
            />}
          btn2={<button className="myGardenBtn" onClick={onAddArea}>+ Add Area</button>}
          btn3={<button className="myGardenBtn" onClick={onRenameArea} disabled={!selectedAreaId}>Rename</button>}
          btn4={<button className="myGardenBtn" onClick={onDeleteArea} disabled={!selectedAreaId}>Delete</button>} />
        <div className="container-fluid" style={{ alignItems: "center", justifyContent: "center", display: "flex", marginBottom: "3vh" }}>
          <div className="TopBar" style={{ maxWidth: "25vw", maxHeight: "8vh", padding: "25px" }}>

            <CustomFileUpload label="upload file" onFileSelect={handleFileChange} />

            <button
              className="MyGardenSecondMenuButton"
              onClick={runDetect}
              disabled={!file || detecting}
              style={{ marginLeft: 8 }}
            >
              {detecting ? "Detecting..." : "Detect"}
            </button>
          </div>
        </div>
        {/* detection status - outside TopBar */}
        {(detecting || detectMessage) && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: -12, marginBottom: 18 }}>
            <div style={{ textAlign: "center", fontSize: "1.5rem", fontWeight: "bold", color: detectMessage ? "#ff0000ff" : "#00f867ff" }}>
              {detecting ? "Detecting... please wait" : detectMessage}
            </div>
          </div>
        )}

        {/* Saved photos for this area with overlays */}
        {savedPhotos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginBottom: 12, justifyItems: "center" }}>
            {savedPhotos.map(p => (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="savedPhotoDisplayerMyGarden" key={p.photo_id} style={{ maxWidth: "95vw", border: '1px solid #ddd', padding: 8, borderRadius: 8, alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: "4vh", color: "white", marginBottom: 4 }}>
                    Photo slot {p.slot} - taken {new Date(p.takenAt).toLocaleString()}
                  </div>
                  <DetectionOverlay
                    src={`http://localhost:12345${p.photo_url}`}
                    natural={{ width: p.width, height: p.height }}
                    detections={plantsByPhoto.get(p.photo_id) || []}
                    maxWidth={480}
                  />
                  <button className="myGardenBtn"
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
                  <button
                    className="myGardenBtn"
                    type="button"
                    onClick={async () => {
                      try {
                        await deletePhoto(p.photo_id);
                        setSavedPlants(prev => prev.filter(pl => pl.photo_id !== p.photo_id));
                        setSavedPhotos(prev => prev.filter(ph => ph.photo_id !== p.photo_id));

                      } catch (e) {
                        console.error(e);
                      }
                    }}>
                    delete photo
                  </button>
                  {/* Global picker model for adding to any saved photo */}
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
                          backgroundColor: "transparent",
                          borderRadius: 8,
                          padding: 12,
                          maxWidth: "90vw",
                          maxHeight: "90vh",
                          overflow: "auto",
                        }}
                        onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
                      >
                        <div style={{ fontSize: "3vh", marginBottom: 8 }}>
                          Pick box - photo slot {savedNew.photo.slot}
                        </div>

                        <div style={{ position: "relative", display: "inline-block" }}>
                          <img
                            ref={savedImgRef}
                            src={`http://localhost:12345${savedNew.photo.photo_url}`}
                            alt=""
                            style={{ display: "block", maxWidth: "80vw", maxHeight: "70vh", width: "100%", height: "auto", border: "1px solid #eee", borderRadius: "10px", aspectRatio: "7/5" }}
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
                      </div>
                    </div>
                  )}

                  {savedNew?.photo?.photo_id === p.photo_id && (
                    <div style={{ marginTop: 8, padding: 8, border: "1px solid #ddd", borderRadius: 6 }}>
                      <div className="formOfInfoOfAddPlantOfSaveOfPhoto" style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}>
                        <h3>Index</h3><div className="numberOfIndexInfo">{savedNew.idx}</div>
                        <h3>Label</h3>
                        <div className="labelOfDataInfo">
                          <input
                            value={savedNew.label}
                            onChange={e => setSavedNew({ ...savedNew, label: e.target.value })}
                            placeholder="e.g., Tomato"
                          />
                        </div>
                        <h3>Container</h3>
                        <div className="labelOfContainerInfo">
                          <select
                            value={savedNew.container}
                            onChange={e => setSavedNew({ ...savedNew, container: e.target.value })}
                          >
                            {CONTAINERS.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <h3>Coords</h3>
                        <div className="labelOfContainerInfo">
                          <code>{savedNew.coords ? JSON.stringify(savedNew.coords) : "(pick on photo above)"}</code>
                        </div>
                        <h3>Notes</h3>
                        <div className="labelOfContainerInfo">
                          <input
                            value={savedNew.notes}
                            onChange={e => setSavedNew({ ...savedNew, notes: e.target.value })}
                            placeholder="optional notes"
                          />
                        </div>
                      </div>
                      <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "center", paddingTop: "5px", paddingBottom: "5px" }}>
                        <button className="addPlantAreaBtnInfo"
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
                            }
                          }}
                        >
                          Save plant
                        </button>
                        <button className="addPlantAreaBtnInfo" type="button" onClick={() => { setSavedNew(null); setPickerSavedOpen(false); }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Saved plants for this area */}
        {savedPlants.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100vw", border: "none", paddingTop: "3vh" }}>
            <table className="TableOfSavedPlants" border="none" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", marginBottom: 16 }}>
              <thead>
                <tr>
                  <th>Photo slot</th>
                  <th>#</th>
                  <th>Label</th>
                  <th>Container</th>
                  <th>
                    <button
                      className="myGardenBtnTiny"
                      type="button"
                      onClick={waterAllToday}
                    >
                      Watered date
                    </button>
                  </th>
                  <th>                <button
                    className="myGardenBtnTiny"
                    type="button"
                    onClick={fertilizedAllToday}
                  >
                    Fertilized date
                  </button></th>
                  <th>Planted</th>
                  <th>Notes</th>
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
                      {/* Watered - show last date, allow set by date picker, plus Today button */}
                      <td className="labelOfContainerInfo">
                        <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
                          <input
                            type="date"
                            max={new Date().toISOString().slice(0, 10)}
                            value={r.lastWateredAt ? String(r.lastWateredAt).slice(0, 10) : ""}
                            onChange={async (e) => {
                              const v = e.target.value || null;
                              await updatePlantDates(r.plant_id, { lastWateredAt: v });
                              const plants = await listAreaPlants(selectedAreaId);
                              setSavedPlants(plants);
                            }}
                          />
                        </div>
                      </td>
                      {/* Fertilized - same pattern */}
                      <td className="labelOfContainerInfo">
                        <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
                          <input
                            type="date"
                            max={new Date().toISOString().slice(0, 10)}
                            value={r.lastFertilizedAt ? String(r.lastFertilizedAt).slice(0, 10) : ""}
                            onChange={async (e) => {
                              const v = e.target.value || null;
                              await updatePlantDates(r.plant_id, { lastFertilizedAt: v });
                              const plants = await listAreaPlants(selectedAreaId);
                              setSavedPlants(plants);
                            }}
                          />
                        </div>
                      </td>

                      <td>{r.plantedMonth && r.plantedYear ? `${String(r.plantedMonth).padStart(2, '0')}/${r.plantedYear}` : ''}</td>
                      <td>
                        <input
                          value={r.notes || ""}
                          onChange={async (e) => {
                            const v = e.target.value;
                            // optimistic local update
                            setSavedPlants(prev => prev.map(p => p.plant_id === r.plant_id ? { ...p, notes: v } : p));
                            try {
                              await updatePlantDates(r.plant_id, { notes: v });
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          placeholder="notes..."
                        />
                      </td>

                      <td>
                        <button className="deleteBtnOfSavedTable" type="button" onClick={() => handleDeleteSavedPlant(r.plant_id)}>
                          Delete
                        </button>
                      </td>
                    </tr>

                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {savedPhotos.length > 0 && (
          <div className="container-fluid" style={{ alignItems: "center", justifyContent: "center", display: "flex", marginBottom: "3vh" }}>
            <div className="TopBar" style={{ maxWidth: "25vw", maxHeight: "8vh", padding: "25px" }}>
              <CustomFileUpload label="upload file" onFileSelect={handleFileChange} />
              <button
                className="MyGardenSecondMenuButton"
                onClick={runDetect}
                disabled={!file}
                style={{ marginLeft: 8 }}
              >
                Detect
              </button>
            </div>
          </div>
        )}
        {/* detection status - outside TopBar */}
        {savedPhotos.length > 0 && (detecting || detectMessage) && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: -12, marginBottom: 18 }}>
            <div style={{ textAlign: "center", fontSize: "1.5rem", fontWeight: "bold", color: detectMessage ? "#ff0000ff" : "#00f867ff" }}>
              {detecting ? "Detecting... please wait" : detectMessage}
            </div>
          </div>
        )}


        {/* Image + overlay */}
        {imgURL ? (
          <div style={{ marginTop: 12, alignItems: "center", justifyContent: "center", display: "flex", paddingBottom: "3vh", gap: "50px" }}>
            <DetectionOverlay
              key={imgURL}                 // force remount on new image
              src={imgURL}
              natural={natural}
              detections={rows}
              maxWidth={720}
            />
            <button className="myGardenBtn"
              type="button"
              onClick={() => {
                const nextIdx = Math.max(0, ...rows.map(r => Number(r.idx) || 0)) + 1;
                setNewRow({
                  idx: nextIdx,
                  label: "",
                  container: "unknown",
                  confidence: 0.99,
                  coords: null,
                  notes: "",
                });
                setPickerOpen(true); // open the BBoxPicker over the current upload
              }}
            >
              Add plant
            </button>
          </div>
        ) : null}

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
          <div style={{ marginTop: 8, padding: 8, border: "1px solid #ddd", borderRadius: 6 }}>
            <div
              className="formOfInfoOfAddPlantOfSaveOfPhoto"
              style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center" }}
            >
              <h3>Index</h3>
              <div className="numberOfIndexInfo">{newRow.idx}</div>

              <h3>Label</h3>
              <div className="labelOfDataInfo">
                <input
                  value={newRow.label}
                  onChange={e => setNewRow({ ...newRow, label: e.target.value })}
                  placeholder="e.g., Tomato"
                />
              </div>

              <h3>Container</h3>
              <div className="labelOfContainerInfo">
                <select
                  value={newRow.container}
                  onChange={e => setNewRow({ ...newRow, container: e.target.value })}
                >
                  {CONTAINERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <h3>Coords</h3>
              <div className="labelOfContainerInfo">
                <div className="labelOfContainerInfo">
                  <code>{newRow?.coords ? JSON.stringify(newRow.coords) : "(pick on photo above)"}</code>
                </div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  Click and drag on the image to draw a rectangle - coordinates are saved as [x1, y1, x2, y2] in pixels.
                </div>
              </div>


              <h3>Notes</h3>
              <div className="labelOfContainerInfo">
                <input
                  value={newRow.notes}
                  onChange={e => setNewRow({ ...newRow, notes: e.target.value })}
                  placeholder="optional notes"
                />
              </div>
            </div>

            <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "center", paddingTop: "5px", paddingBottom: "5px" }}>
              <button className="addPlantAreaBtnInfo" type="button" onClick={onSaveNewRow}>
                Save to table
              </button>
              <button className="addPlantAreaBtnInfo" type="button" onClick={onCancelNewRow}>
                Cancel
              </button>
            </div>
          </div>
        )}


        {/* Table + Save */}
        {rows.length > 0 && (
          <>
            <PlantTable rows={rows} setRows={setRows} containerOptions={CONTAINERS} />
            <div style={{ marginTop: 12 }}>
              <button className="myGardenBtn" style={{ minHeight: "60px" }} onClick={handleSavePhotoAndPlants}>
                Save Photo + Plants
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
