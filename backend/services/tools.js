const Plant = require("../models/plant");
const Photo = require("../models/photos");
const WEATHER_BASE = "http://127.0.0.1:2021/weather";

function pickWeatherSummary(j) {
  return {
    weekly_outlook: Array.isArray(j?.weekly_outlook) ? j.weekly_outlook : [],
    prev_week_features: j?.prev_week_features || null
  };
}
const tools = {
   async get_plant({ plant_id, label }, { userId }) {
    const q = { userId };
    if (plant_id) q._id = plant_id;
    else if (label) q.label = new RegExp(`^${label}$`, "i");

    const p = await Plant.findOne(q).lean();
    if (!p) return { not_found: true };

    // 2) Load its photo to get area, slot, file, dims
    const ph = await Photo.findOne({ _id: p.photoId, userId }).lean();
    // If photo missing, still return the plant fields we have
    const areaId = ph ? String(ph.areaId) : String(p.areaId);
    const slot = ph ? ph.slot : null;
    const width = ph ? ph.width : null;
    const height = ph ? ph.height : null;
    const photoUrl = ph ? `/static/photos/${ph.fileName}` : null;
    return {
      type: "PLANT_CONTEXT",
      plant_id: String(p._id),
      label: p.label,
      container: p.container,
      idx: p.idx,                        // index on the photo
      bbox_px: Array.isArray(p.coordsPx) ? p.coordsPx.map(Number) : null, // [x1,y1,x2,y2]
      notes: p.notes || "",
      chatNote: p.chatNote || "",
      lastWateredAt: p.lastWateredAt || null,
      lastFertilizedAt: p.lastFertilizedAt || null,
      plantedMonth: p.plantedMonth ?? null,
      plantedYear: p.plantedYear ?? null,

      area_id: areaId,
      photo_id: ph ? String(ph._id) : String(p.photoId),
      slot,          // 1..3
      photo: {
        url: photoUrl, // serveable URL
        width,
        height,
      }
    };
  },

  async update_plant_note({ plant_id, note }, { userId }) {
    const clean = String(note).slice(0, 500);
    const p = await Plant.findOne({ _id: plant_id, userId });
    if (!p) return { not_found: true };
    p.chatNote = clean;
    await p.save();
    return { ok: true, chatNote: p.chatNote };
  },

  async get_weather({ lat, lon }, { userId }) {
    try {
      const latNum = Number(lat);
      const lonNum = Number(lon);
      if (!isFinite(latNum) || !isFinite(lonNum)) {
        return { error: "lat and lon are required numbers" };
      }

      const resp = await fetch(WEATHER_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: latNum, longitude: lonNum })
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        return { error: `weather service failed ${resp.status}`, details: txt.slice(0, 500) };
      }

      const raw = await resp.text();
      let data = null;
      try { data = JSON.parse(raw); } catch (_) {}

      if (!data) return { error: "invalid weather JSON" };

      return pickWeatherSummary(data);
    } catch (e) {
      return { error: "weather tool exception", details: String(e).slice(0, 500) };
    }
  }
};
module.exports = { tools };
