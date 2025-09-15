import { useState } from "react";
import { authHeaders } from "../api/http";
import { postTip } from "../api/helper";
import TopBar from "../art/components/topbar.js";
import DailyTip from "../art/components/dailyTip.js";
import Background from "../art/components/Background.js";
import SlideShow from "../art/components/SlidesShow.js";
import "../art/components/components.css"

const API_BASE = "http://localhost:12345/api";
// this is the welcome page, it consists some information about the user and recommendations for it
const systemMessage = `
You are Garden Weekly UI Engine. Produce one concise daily tip and a weekly carousel of topic cards for this specific home garden using only the provided data. Be precise, practical, and friendly. If not enough specific content exists, return safe generics.
`.trim();

const developerMessage = `
Objectives
1) Output two things:
   A. daily_tip - one item with header, subheader, and a 40-80 word body.
   B. topics - 3 to 8 weekly topic cards. Each card has a header and a short body.

2) The daily tip must be an elevated pick from the topics. Link it with source_topic_tag and do not copy-paste the same sentences. Expand it with the most urgent and helpful details for today.

Allowed topic headers
- Weekly irrigation plan
- Weekly weather summary
- Plant of the week
- Pest watch
- Harvest radar
- Fertilizing planner
- General garden tip

Selection priorities for both daily_tip and topics (highest to lowest)
1) Weather impact and scheduling - rain vs irrigation, heat, frost, wind
2) Plant-stage windows by local month - sowing, flowering, fruit set, harvest
3) Due or overdue care by intervals - watering, fertilizing, pruning, staking, pest checks
4) Local seasonality and light maintenance - mulch, irrigation checks, tool care
5) Generic evergreen items only to reach the count

Novelty
- daily_tip - do not repeat any topic_tag or near duplicate from the last 10 visits
- topics - avoid repeating the same topic_tag used in the last 21 days unless weather-critical
- Prefer diversity across categories. Maximum 2 cards from the same category.

Weather guardrails
- Never advise watering if rain_next_24h_mm >= 3 or soil likely wet
- heat_flag - prefer deep watering in morning, shade or mulch tasks
- frost_flag - protection tasks and deferrals
- wind_gusty_flag - staking or defer spraying
- uv_high_flag - schedule morning or late afternoon

Style
- daily_tip.header <= 60 chars, daily_tip.subheader <= 90 chars, daily_tip.message 40-80 words, one actionable step, no emojis, no bullet lists
- topic card header must be exactly one of the allowed topic headers above
- topic card body is short and skimmable - 25-80 words, 1-3 sentences, no emojis, no bullet lists
- Mention specific plants by common name when relevant. Prefer concrete amounts or thresholds when available. Never invent plant types or dates.

Topic guidance
- Weekly irrigation plan - micro guidance for the next 7 days based on rain_next_24h_mm, heat_flag, container vs beds if known. Include a simple decision rule the user can apply this week.
- Weekly weather summary - 5-7 day outlook. If prev_week_features are present, note the change vs last week and how to adjust.
- Plant of the week - choose a garden plant not spotlighted in the last 4 weeks. If no plants exist, choose a common outdoor edible or shrub suitable for the location and season. Cover 2-4 of: Care Tips, Water, Sunlight, Temperature, Soil, Fertilize, Prune, Propagation, Transplant, Overwinter, Planting, Repotting, Harvest, Common Pests & Diseases. Keep to 25-80 words total.
- Pest watch - seasonal pests to scout now and when to check. Add a simple action if found.
- Harvest radar - only for plants in the user’s garden that are likely in fruiting or harvest stage. Never invent plants.
- Fertilizing planner - who is due in the next 7 days based on last_fertilized_at and care_intervals. Give rate or type only if provided in input.
- General garden tip - only when you need to reach the minimum count. Prefer tool care, mulch depth, irrigation checks.

Output schema - strict JSON only
{
  "daily_tip": {
    "header": "string <= 60",
    "subheader": "string <= 90",
    "message": "string 40-80 words",
    "category": "weather|watering|fertilizing|pruning|pests|harvest|planting|irrigation|cleanup|tools|houseplant|safety|general",
    "topic_tag": "kebab-case",
    "source_topic_tag": "kebab-case of the chosen topic card",
    "plant_ids": ["optional"],
    "novelty_reason": "string",
    "source_data_refs": ["e.g. weather.tomorrow.rain_mm", "plants.tomato.stage"],
    "next_review_date": "YYYY-MM-DD"
  },
  "topics": [
    {
      "header": "one of the allowed topic headers",
      "body": "string 25-80 words",
      "category": "weather|watering|fertilizing|pruning|pests|harvest|planting|irrigation|cleanup|tools|houseplant|safety|general",
      "topic_tag": "kebab-case",
      "plant_ids": ["optional"],
      "relevance_score": 0.0,
      "include": true
    }
  ],
  "generation_notes": "why these were chosen"
}

Quantity and diversity
- Aim for 6 topic cards. Minimum 3, maximum 8.
- Sort topics by relevance_score descending. Mark non-relevant cards include=false.

Watering micro-logic to apply consistently
- If rain_next_24h_mm >= 3 - say to skip watering today and recheck tomorrow
- Else if heat_flag - morning deep-water for containers, finger test beds at 3-5 cm
- Else - finger test at 3-5 cm and water only if dry. Prefer deep but infrequent watering.
`.trim();


/** ====================== JSONUtilitie ====================== */
function enrichFlagsWithWeeklyBase(features, weekly) {
  try {
    if (!Array.isArray(weekly) || weekly.length === 0) return features;
    const dTomorrow = new Date(Date.now() + 86400000).toISOString().slice(0,10);
    const tmr = weekly.find(d => d.date === dTomorrow) || weekly[1];
    const f = { ...features };
    if (Number.isFinite(tmr?.max_wind_kph)) f.wind_gusty_flag = tmr.max_wind_kph >= 35;
    if (Number.isFinite(tmr?.uv_index_max)) f.uv_high_flag = tmr.uv_index_max >= 8;
    return f;
  } catch { return features; }
}

// normalize to YYYY-MM-DD
function toYMD(iso) {
  try { return new Date(iso).toISOString().slice(0, 10); }
  catch { return new Date().toISOString().slice(0, 10); }
}

// turn your weather_summary into the expected "weather"
function toWeatherFromSummary(weather_summary, week) {
  if (!weather_summary?.available) return undefined;
  const w = {
    today: weather_summary.today && {
      date: weather_summary.today.date,
      t_min_c: weather_summary.today.t_min_c,
      t_max_c: weather_summary.today.t_max_c,
      rain_mm: weather_summary.today.rain_mm
    },
    tomorrow: weather_summary.tomorrow && {
      date: weather_summary.tomorrow.date,
      t_min_c: weather_summary.tomorrow.t_min_c,
      t_max_c: weather_summary.tomorrow.t_max_c,
      rain_mm: weather_summary.tomorrow.rain_mm
    }
  };
  if (Array.isArray(week) && week.length > 0) {
    w.week = week; 
  }
  return stripNullsDeep(w);
}



// novelty buffers - minimal localStorage versions - for right now!!!
function loadRecentTopics() {
  try { return JSON.parse(localStorage.getItem("recent_topics") || "[]"); }
  catch { return []; }
}
function saveRecentTopics(topicArray) {
  try {
    const now = new Date().toISOString().slice(0, 10);
    const prev = loadRecentTopics().filter(x => {
      const d = new Date(x.date);
      return Date.now() - d.getTime() < 21 * 24 * 3600 * 1000;
    });
    const add = (topicArray || []).map(t => ({ topic_tag: t.topic_tag, date: now }));
    localStorage.setItem("recent_topics", JSON.stringify([...prev, ...add].slice(-100)));
  } catch { }
}

// group plants to plants_by_area from "flat"
function groupPlantsByArea(flat) {
  const map = new Map();
  for (const p of flat) {
    const key = p.area_id || "unknown";
    if (!map.has(key)) map.set(key, { area_id: p.area_id, area_name: p.area_name, plants: [] });
    // keep fields you actually have - do not invent missing ones
    map.get(key).plants.push({
      plant_id: p.plant_id,
      plant_label: p.plant_label,
      container: p.container,
      planted_month: p.planted_month ?? undefined,
      last_watered_at: p.last_watered_at ?? undefined,
      last_fertilized_at: p.last_fertilized_at ?? undefined
    });
  }
  return Array.from(map.values());
}

/** ====================== Utilities ====================== */
function buildLocationBlock({ latitude, longitude, tz, isoDate }) {
  const month = Number(isoDate.slice(5, 7));
  const hemisphere = latitude >= 0 ? "northern" : "southern";
  // A simple, explicit mapping for season - no guesswork beyond hemisphere+month
  const seasonByHemisphere = {
    northern: ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"],
    southern: ["summer", "summer", "autumn", "autumn", "autumn", "winter", "winter", "winter", "spring", "spring", "spring", "summer"],
  };
  const season = seasonByHemisphere[hemisphere][month - 1];
  return {
    latitude: Number(latitude.toFixed(4)),
    longitude: Number(longitude.toFixed(4)),
    timezone: tz,
    hemisphere,
    month,
    season
  };
}

function computeWeatherFeaturesFromSummary(summary) {
  if (!summary?.available) {
    return {
      rain_next_24h_mm: null,
      heat_flag: false,
      frost_flag: false,
      wind_gusty_flag: false,
      uv_high_flag: false
    };
  }

  const base = summary.tomorrow || summary.today || {};
  const tmax = base.t_max_c;
  const tmin = base.t_min_c;
  const rain24 = base.rain_mm;

  const maxWind = base.max_wind_kph;   
  const maxUvi  = base.uv_index_max;   

  return {
    rain_next_24h_mm: Number.isFinite(rain24) ? rain24 : null,
    heat_flag: Number.isFinite(tmax) ? tmax >= 32 : false,
    frost_flag: Number.isFinite(tmin) ? tmin <= 2 : false,
    wind_gusty_flag: Number.isFinite(maxWind) ? maxWind >= 35 : false, 
    uv_high_flag: Number.isFinite(maxUvi) ? maxUvi >= 8 : false        
  };
}


function stripNullsDeep(obj) {
  if (Array.isArray(obj)) {
    return obj.map(stripNullsDeep).filter(v => v !== undefined);
  }
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const vv = stripNullsDeep(v);
      if (vv !== undefined && vv !== null && vv !== "") out[k] = vv;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return obj === null ? undefined : obj;
}

function compactPlants(plants) {
  return plants.map(p => ({
    plant_id: p.plant_id,
    plant_label: p.plant_label,
    species: p.species ?? undefined,
    container: p.container,
    planted_month: p.planted_month ?? undefined,
    last_watered_at: p.last_watered_at ?? undefined,
    last_fertilized_at: p.last_fertilized_at ?? undefined,
    area_id: p.area_id,
    area_name: p.area_name
  }));
}

// verifying plantDoc name until finalized project
function normalizePlantDoc(d) {
  const label =
    d?.label ?? d?.plant_label ?? d?.name ?? d?.commonName ?? d?.species ?? "Plant";

  const arr =
    toFour(d?.coords) ||
    toFour(d?.coordsPx) ||
    toFour(d?.coords_px) ||
    toFour(d?.bounding_box) ||
    toFour([d?.x1, d?.y1, d?.x2, d?.y2]) ||
    null;

  let bbox = "unknown";
  if (arr) {
    const [x1, y1, x2, y2] = arr.map(v => Math.round(Number(v)));
    bbox = `${x1},${y1},${x2},${y2}`;
  } else if (typeof d?.bounding_box === "string" && d.bounding_box.trim()) {
    bbox = d.bounding_box.trim();
  }

  return {
    plant_id: d?.plant_id || d?._id || d?.id || null,
    plant_label: String(label),
    species: d?.species || d?.scientificName || null,
    container: d?.container || "unknown",
    confidence: d?.confidence ?? d?.score ?? null,
    bounding_box: String(bbox),
    coords_px: arr,
    planted_month: d?.planted_month ?? d?.plantedMonth ?? null,
    last_watered_at: d?.last_watered_at ?? d?.lastWateredAt ?? null,
    last_fertilized_at: d?.last_fertilized_at ?? d?.lastFertilizedAt ?? null,
    notes: d?.notes || ""
  };
}


// Coerce various inputs into [x1,y1,x2,y2]
function toFour(src) {
  if (!src) return null;

  if (Array.isArray(src)) {
    const vals = src.map(Number);
    return vals.length === 4 && vals.every(Number.isFinite) ? vals : null;
  }

  if (typeof src === "string") {
    const parts = src.split(/[,\s]+/).filter(Boolean).map(Number);
    return parts.length === 4 && parts.every(Number.isFinite) ? parts : null;
  }

  if (typeof src === "object") {
    // numeric keys or explicit x1..y2 keys
    const byIndex = ["0", "1", "2", "3"].map(k => src[k]);
    if (byIndex.every(v => v !== undefined)) {
      const vals = byIndex.map(Number);
      return vals.length === 4 && vals.every(Number.isFinite) ? vals : null;
    }
    const xy = [src.x1, src.y1, src.x2, src.y2].map(Number);
    return xy.length === 4 && xy.every(Number.isFinite) ? xy : null;
  }

  return null;
}

// taking the text and extract only the JSON
function extractJsonFromText(text) {
  if (!text || typeof text !== "string") return null;

  // Prefer content inside triple fences if present
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  let s = fence ? fence[1].trim() : text.trim();

  // Try a straight parse first
  try { return JSON.parse(s); } catch { }

  // If there is an object, extract the first balanced {...}
  const objStart = s.indexOf("{");
  const arrStart = s.indexOf("[");
  let start = -1, mode = null;
  if (objStart !== -1 && (arrStart === -1 || objStart < arrStart)) {
    start = objStart; mode = "obj";
  } else if (arrStart !== -1) {
    start = arrStart; mode = "arr";
  }
  if (start === -1) return null;

  // Balance braces or brackets from the first opener
  let depth = 0;
  let end = -1;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (mode === "obj") {
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) { end = i + 1; break; }
      }
    } else {
      if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) { end = i + 1; break; }
      }
    }
  }
  if (end !== -1) {
    const candidate = s.slice(start, end);
    try { return JSON.parse(candidate); } catch { }
  }

  // As a last resort, walk left from the last '}' or ']'
  //    to recover a parseable prefix
  const lastClose = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  for (let i = lastClose; i >= start && i >= 0; i--) {
    const slice = s.slice(start, i + 1);
    try { return JSON.parse(slice); } catch { }
  }
  return null;
}
function round1(n) { return Number.isFinite(n) ? Math.round(n * 10) / 10 : null; }

function deriveDailyFromHourly(weatherRaw, tzNowIso) {
  const H = weatherRaw?.hourly;
  if (!H?.time || !H.temperature_2m) return { available: false };

  const times = H.time;
  const temps = H.temperature_2m;
  const precip = H.precipitation || [];
  const wind   = H.windspeed_10m || [];   // may be missing if backend not yet updated
  const uvi    = H.uv_index || [];        // may be missing if backend not yet updated

  const now = new Date(tzNowIso);
  const todayYMD = tzNowIso.slice(0, 10);
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  const tomorrowYMD = tomorrow.toISOString().slice(0, 10);

  const buckets = { [todayYMD]: [], [tomorrowYMD]: [] };

  for (let i = 0; i < times.length; i++) {
    const ymd = String(times[i]).slice(0, 10);
    if (buckets[ymd]) {
      buckets[ymd].push({
        t: temps[i],
        r: precip[i] ?? 0,
        w: wind[i] ?? null,
        u: uvi[i] ?? null
      });
    }
  }

  function summarize(hours) {
    if (!hours || hours.length === 0) return null;
    const tmin = Math.min(...hours.map(h => Number(h.t)));
    const tmax = Math.max(...hours.map(h => Number(h.t)));
    const rsum = hours.reduce((a, h) => a + (Number(h.r) || 0), 0);

    // compute daily maxima when data is present
    const winds = hours.map(h => Number(h.w)).filter(Number.isFinite);
    const uvis  = hours.map(h => Number(h.u)).filter(Number.isFinite);
    const maxWind = winds.length ? Math.max(...winds) : null;       // kph from Open-Meteo
    const maxUVI  = uvis.length ? Math.max(...uvis) : null;

    return {
      t_min_c: round1(tmin),
      t_max_c: round1(tmax),
      rain_mm: round1(rsum),
      ...(maxWind !== null ? { max_wind_kph: round1(maxWind) } : {}),
      ...(maxUVI  !== null ? { uv_index_max:  round1(maxUVI) }  : {})
    };
  }

  const today = summarize(buckets[todayYMD]);
  const tomorrowS = summarize(buckets[tomorrowYMD]);

  return {
    available: Boolean(today || tomorrowS),
    today: today ? { date: todayYMD, ...today } : null,
    tomorrow: tomorrowS ? { date: tomorrowYMD, ...tomorrowS } : null
  };
}


/** ====================== API wrappers ====================== */

// returns the list of all of the areas there are
async function listAreas() {
  const res = await fetch(`${API_BASE}/areas`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(`listAreas failed: ${res.status}`);
  return res.json(); // expect something like [{ _id, name, ... }, ...]
}
// returns all of the plants that resides in this areaID using fetch to the server
async function listAreaPlants(areaId) {
  const res = await fetch(`${API_BASE}/areas/${areaId}/plants`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(`listAreaPlants failed: ${res.status}`);
  return res.json(); // array of plant docs for that area
}

// Load whole garden grouped by areas
async function loadGardenPlantsByArea() {
  const areas = await listAreas();

  // Normalize ids and names first
  const normalizedAreas = (areas || [])
    .map((a, i) => ({
      area_id: a.area_id || a._id || a.id || null,
      area_name: a.name || a.area_name || `Area ${i + 1}`,
      orderIndex: a.orderIndex ?? i,
    }))
    .filter(a => !!a.area_id);

  const perArea = await Promise.all(
    normalizedAreas.map(async a => {
      const docs = await listAreaPlants(a.area_id);
      const plants = (docs || []).map(normalizePlantDoc);
      return { ...a, plants };
    })
  );
  return perArea;
}

// taking the plants and adding the area name and ID to a nice JSON format
function flattenPlants(plantsByArea) {
  const flat = [];
  for (const area of plantsByArea) {
    for (const p of area.plants) {
      flat.push({ ...p, area_id: area.area_id, area_name: area.area_name });
    }
  }
  return flat;
}

/** ====================== LLM call ====================== */

function parseTipText(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("LLM returned empty text");
  }
  try { return JSON.parse(text); } catch { }
  const parsed = extractJsonFromText(text);
  if (!parsed) throw new Error("LLM returned non-JSON");
  return parsed;
}

async function callTip(systemMessage, developerMessage, chatPrompt) {
  const userPrompt = JSON.stringify(chatPrompt);
  const out = await postTip({
    system: systemMessage,
    developer: developerMessage,
    user: userPrompt
  });
  const tip = parseTipText(out.text);
  return tip;
}


//change this section to actualy work = this is just generic/////////////////////////////////////////////////////////
function loadRecentTips() {
  try { return JSON.parse(localStorage.getItem("recent_tips") || "[]").slice(-10); }
  catch { return []; }
}
function saveRecentTip(tipJson) {
  try {
    const arr = loadRecentTips();
    const tag = tipJson?.daily_tip?.topic_tag || "unknown";
    const msg = tipJson?.daily_tip?.message || "";
    arr.push({
      topic_tag: tag,
      plant_ids: tipJson?.daily_tip?.plant_ids || [],
      message_norm: msg.toLowerCase().replace(/[^\w\s]/g, ""),
      date: new Date().toISOString().slice(0, 10)
    });
    localStorage.setItem("recent_tips", JSON.stringify(arr.slice(-10)));
  } catch { }
}
//TODO: change this section to work with mongoDB = this is just generic/////////////////////////////////////////////////////////

/** ====================== main method ====================== */
const Welcome = () => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ai, setAi] = useState({ recommendations: [], explanation: "" });
  const [snapshot, setSnapshot] = useState({ areas: [], flat: [] });
  const [debugPrompt, setDebugPrompt] = useState(null);
  const [debugWeather, setDebugWeather] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  // this function creates the garden recommandation scheme and the output is the recommendation that is presented to the user
  async function buildAndSendGardenPlan() {
    setError("");
    setLoading(true);

    try {
      // 1 - geolocation
      const coords = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
        navigator.geolocation.getCurrentPosition(
          pos => resolve(pos.coords),
          err => reject(new Error(`Geolocation error: ${err.message}`))
        );
      });
      const { latitude, longitude } = coords;
      setLocation({ latitude, longitude });

      // 2 - fetch weather (raw)
      const weatherResp = await fetch("http://127.0.0.1:2021/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude }),
      });
      if (!weatherResp.ok) {
        const txt = await weatherResp.text().catch(() => "");
        throw new Error(`Weather HTTP ${weatherResp.status} ${txt}`);
      }
      let weatherRaw;
      try {
        weatherRaw = await weatherResp.json();
      } catch {
        throw new Error("Weather service returned invalid JSON");
      }
      function sanitizeRecentTips(arr) {
  return (arr || [])
    .filter(x => x && (x.topic_tag || x.message_norm))
    .slice(-10);
}

const weeklyOutlook = Array.isArray(weatherRaw.weekly_outlook) ? weatherRaw.weekly_outlook : [];
const prevWeekFeatures = weatherRaw.prev_week_features && typeof weatherRaw.prev_week_features === "object"
  ? weatherRaw.prev_week_features
  : null;
      // 3 - time and location block
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jerusalem";
      const isoDate = new Date().toISOString();
      const location_block = buildLocationBlock({ latitude, longitude, tz, isoDate });

      // 4 - derive compact weather summary + features for LLM
      const weather_summary = deriveDailyFromHourly(weatherRaw, isoDate);
      const weather_features = enrichFlagsWithWeeklyBase(computeWeatherFeaturesFromSummary(weather_summary),weeklyOutlook);

      // 5 - load plants before setSnapshot
      const plantsByArea = await loadGardenPlantsByArea();
      const flat = flattenPlants(plantsByArea);
      setSnapshot({ areas: plantsByArea, flat });

      // 6 - build compact LLM payload - matches the agreed schema
      const calendarYMD = new Date(isoDate).toISOString().slice(0, 10);
      const weather = toWeatherFromSummary(weather_summary, weeklyOutlook);
      const plants_by_area = groupPlantsByArea(flat);
      const recent_tips = sanitizeRecentTips(loadRecentTips());
      const recent_topics = loadRecentTopics(); // optional helper from earlier

      const knowledge = {
        regional_windows: [],
        care_intervals: {}
      };

      const userPayload = stripNullsDeep({
        user_timezone: tz,
        calendar_today: calendarYMD,
        location: { latitude, longitude },
        weather,
        weather_features,
        plants_by_area,
        plants: compactPlants(flat),
        recent_tips,
        recent_topics,
        knowledge,
          ...(prevWeekFeatures ? { prev_week_features: prevWeekFeatures } : {})
      });

      // debug
      setDebugPrompt({ system: systemMessage, developer: developerMessage, user: userPayload });

      // send
      const tip = await callTip(systemMessage, developerMessage, userPayload);


      // 9 - store
      saveRecentTip(tip);
      setAi({ recommendations: [tip], explanation: "" });
    } catch (e) {
      console.error(e);
      setError(e.message || "Unknown error");
      setAi({ recommendations: [], explanation: "" });
    } finally {
      setLoading(false);
    }
  }
  const slides = [
    {
      photo: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200",
      text: "Explore the garden",
      ref: "/garden"
    },
    {
      photo: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1200",
      text: "Watering tips",
      ref: "/tips/watering"
    },
    {
      photo: "https://images.unsplash.com/photo-1496483353456-90997957cf99?q=80&w=1200",
      text: "Fertilizing guide",
      ref: "/tips/fertilizing"
    }, {
      photo: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200",
      text: "Explore the garden",
      ref: "/garden"
    },
    {
      photo: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1200",
      text: "Watering tips",
      ref: "/tips/watering"
    },
    {
      photo: "https://images.unsplash.com/photo-1496483353456-90997957cf99?q=80&w=1200",
      text: "Fertilizing guide",
      ref: "/tips/fertilizing"
    }, {
      photo: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200",
      text: "Explore the garden",
      ref: "/garden"
    },
    {
      photo: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1200",
      text: "Watering tips",
      ref: "/tips/watering"
    },
    {
      photo: "https://images.unsplash.com/photo-1496483353456-90997957cf99?q=80&w=1200",
      text: "Fertilizing guide",
      ref: "/tips/fertilizing"
    }, {
      photo: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200",
      text: "Explore the garden",
      ref: "/garden"
    },
    {
      photo: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1200",
      text: "Watering tips",
      ref: "/tips/watering"
    },
    {
      photo: "https://images.unsplash.com/photo-1496483353456-90997957cf99?q=80&w=1200",
      text: "Fertilizing guide",
      ref: "/tips/fertilizing"
    }, {
      photo: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200",
      text: "Explore the garden",
      ref: "/garden"
    },
    {
      photo: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1200",
      text: "Watering tips",
      ref: "/tips/watering"
    },
    {
      photo: "https://images.unsplash.com/photo-1496483353456-90997957cf99?q=80&w=1200",
      text: "Fertilizing guide",
      ref: "/tips/fertilizing"
    }, {
      photo: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200",
      text: "Explore the garden",
      ref: "/garden"
    },
    {
      photo: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1200",
      text: "Watering tips",
      ref: "/tips/watering"
    },
    {
      photo: "https://images.unsplash.com/photo-1496483353456-90997957cf99?q=80&w=1200",
      text: "Fertilizing guide",
      ref: "/tips/fertilizing"
    }, {
      photo: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200",
      text: "Explore the garden",
      ref: "/garden"
    },
    {
      photo: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?q=80&w=1200",
      text: "Watering tips",
      ref: "/tips/watering"
    },
    {
      photo: "https://images.unsplash.com/photo-1496483353456-90997957cf99?q=80&w=1200",
      text: "Fertilizing guide",
      ref: "/tips/fertilizing"
    }
  ];


  return (
    <>
      <Background />
      <div style={{ overflowX: "hidden", overflowY: "auto", position: "sticky" }}>
        <div >
          <TopBar />
          <DailyTip
            header= {ai.recommendations[0]?.daily_tip?.header||""}
            subheader={ai.recommendations[0]?.daily_tip?.subheader||""}
            content={ai.recommendations[0]?.daily_tip?.message||""}
          />
          <SlideShow slidesComponents={slides} title="Ready for the week ahead" />
          {/* <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button
          className="my-garden-button"
          type="button"
          onClick={() => (window.location.href = "/MyGarden")}
        >
          Enter your gardens
        </button>

        
        </div> */}
          <button
            type="button"
            onClick={buildAndSendGardenPlan}
            disabled={loading}
            title="Geolocate, fetch weather and your entire garden, then ask the AI for a care plan"
          >
            {loading ? "Working..." : "Get garden care plan"}
          </button>
          {debugPrompt && (
            <>
              <div>User request</div>
              <pre>{JSON.stringify(debugPrompt.user, null, 2)}</pre>
            </>
          )}

          {ai.recommendations.length > 0 && (
            <>
              <div>AI response</div>
              <pre>{JSON.stringify(ai.recommendations[0], null, 2)}</pre>
            </>
          )}
        </div>
      </div></>);
}
export default Welcome;
