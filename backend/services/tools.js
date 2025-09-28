// Import required models for plants and photos
const Plant = require("../models/plant");
const Photo = require("../models/photos");

// Base URL for the weather service
const WEATHER_BASE = process.env.WEATHER_BASE || "http://pyserver:2021/weather";
// Helper function to extract relevant weather summary fields
function pickWeatherSummary(j) {
  return {
    weekly_outlook: Array.isArray(j?.weekly_outlook) ? j.weekly_outlook : [],
    prev_week_features: j?.prev_week_features || null
  };
}

// Main tools object containing service functions
const tools = {
  // Retrieve plant context by plant_id or label for a given user
  async get_plant({ plant_id, label }, { userId }) {
    // Build query based on provided plant_id or label
    const q = { userId };
    if (plant_id) q._id = plant_id;
    else if (label) q.label = new RegExp(`^${label}$`, "i");

    // Find the plant document
    const p = await Plant.findOne(q).lean();
    if (!p) return { not_found: true };

    // Load associated photo for additional context (area, slot, file, dimensions)
    const ph = await Photo.findOne({ _id: p.photoId, userId }).lean();

    // Extract area and photo details, fallback to plant fields if photo missing
    const areaId = ph ? String(ph.areaId) : String(p.areaId);
    const slot = ph ? ph.slot : null;
    const width = ph ? ph.width : null;
    const height = ph ? ph.height : null;
    const photoUrl = ph ? `/static/photos/${ph.fileName}` : null;

    // Return plant context object with relevant fields
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

  // Update the chat note for a plant, limited to 500 characters
  async update_plant_note({ plant_id, note }, { userId }) {
    const clean = String(note).slice(0, 500);
    const p = await Plant.findOne({ _id: plant_id, userId });
    if (!p) return { not_found: true };
    p.chatNote = clean;
    await p.save();
    return { ok: true, chatNote: p.chatNote };
  },

  // Fetch weather data for a given latitude and longitude
  async get_weather({ lat, lon }, { userId }) {
    try {
      // Validate latitude and longitude
      const latNum = Number(lat);
      const lonNum = Number(lon);
      if (!isFinite(latNum) || !isFinite(lonNum)) {
        return { error: "lat and lon are required numbers" };
      }

      // Make POST request to weather service
      const resp = await fetch(WEATHER_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: latNum, longitude: lonNum })
      });

      // Handle non-OK responses
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        return { error: `weather service failed ${resp.status}`, details: txt.slice(0, 500) };
      }

      // Parse response JSON
      const raw = await resp.text();
      let data = null;
      try { data = JSON.parse(raw); } catch (_) {}

      if (!data) return { error: "invalid weather JSON" };

      // Return summarized weather data
      return pickWeatherSummary(data);
    } catch (e) {
      return { error: "weather tool exception", details: String(e).slice(0, 500) };
    }
  }
};

module.exports = { tools };
