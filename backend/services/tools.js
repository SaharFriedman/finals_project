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
    return {
      plant_id: String(p._id),
      label: p.label,
      container: p.container,
      lastWateredAt: p.lastWateredAt,
      lastFertilizedAt: p.lastFertilizedAt,
      chatNote: p.chatNote
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

  async request_slot_photo({ area_id, slot_id }, { userId }) {
    return {
      action: "UPLOAD_SLOT_PHOTO",
      area_id, slot_id,
      instructions: "Please upload a clear photo for this slot."
    };
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
