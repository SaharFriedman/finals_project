import SignOutButton from "../components/SignOutButton";
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
You are Garden Daily Tip Engine. Produce one concise, high-value tip using only the provided input. Always obey the Output schema exactly and return strict JSON only.
`.trim();

const developerMessage = `
Hard constraints
- Use only the values in location_block, weather_features, weather_summary, and plants. If a field is null or missing, treat it as unknown.
- Do not infer climate or seasons beyond what location_block gives you.
- Never mention frost unless weather_features.frost_flag === true.
- Never mention heatwave unless weather_features.heat_flag === true.
- Never recommend watering if weather_features.rain_next_24h_mm >= 3.
- If weather_summary.available === false, avoid weather-based advice and use seasonality only if provided via location_block.

Decision rules (priority high to low)
A) Imminent weather impact on tasks - only if *_flag is true or numeric thresholds appear.
B) Plant-stage windows by month - use location_block.hemisphere and calendar_today to infer season if provided there.
C) Care schedule due now or overdue (watering, fertilizing, pruning, staking, pest checks).
D) General best practice fallback.

Style and output
- One tip only. 40-80 words. One actionable step. No lists. No emojis.
- Mention specific plants when relevant (common name only). Prefer concrete amounts or thresholds when available.
- Avoid hedging and repetition. No marketing language.

Output schema
Return strict JSON only:
{
  "title": "string, ≤ 60 chars",
  "message": "string, 40-80 words",
  "category": "weather|watering|fertilizing|pruning|pests|harvest|planting|general",
  "topic_tag": "kebab-case short tag, used for dedupe",
  "plant_ids": ["optional array of plant_id strings"],
  "novelty_reason": "why this is new vs last 10",
  "source_data_refs": ["like weather_features.tmin_c", "plants.<name>.<field>"],
  "next_review_date": "YYYY-MM-DD"
}
`.trim();



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
      tmax_c: null, tmin_c: null, rain_next_24h_mm: null,
      uv_index: null, wind_kph: null,
      heat_flag: false, frost_flag: false, wind_gusty_flag: false, uv_high_flag: false
    };
  }
  const tmax = summary.tomorrow?.t_max_c ?? summary.today?.t_max_c ?? null;
  const tmin = summary.tomorrow?.t_min_c ?? summary.today?.t_min_c ?? null;
  const rain24 = summary.tomorrow?.rain_mm ?? null;
  return {
    tmax_c: tmax,
    tmin_c: tmin,
    rain_next_24h_mm: rain24,
    uv_index: null,
    wind_kph: null,
    heat_flag: Number.isFinite(tmax) ? tmax >= 32 : false,
    frost_flag: Number.isFinite(tmin) ? tmin <= 2 : false,
    wind_gusty_flag: false,
    uv_high_flag: false
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
  if (!weatherRaw?.hourly?.time || !weatherRaw.hourly.temperature_2m) {
    return { available: false };
  }
  // Map each hourly record into local day buckets for today and tomorrow
  const times = weatherRaw.hourly.time;
  const temps = weatherRaw.hourly.temperature_2m;
  const precip = weatherRaw.hourly.precipitation || [];
  const now = new Date(tzNowIso);
  const todayYMD = tzNowIso.slice(0, 10);
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  const tomorrowYMD = tomorrow.toISOString().slice(0, 10);

  const buckets = { [todayYMD]: [], [tomorrowYMD]: [] };

  for (let i = 0; i < times.length; i++) {
    const ymd = times[i].slice(0, 10);
    if (buckets[ymd]) {
      buckets[ymd].push({
        t: temps[i],
        r: precip[i] ?? 0
      });
    }
  }

  function summarize(hours) {
    if (!hours || hours.length === 0) return null;
    const tmin = Math.min(...hours.map(h => h.t));
    const tmax = Math.max(...hours.map(h => h.t));
    const rsum = hours.reduce((a, h) => a + (Number(h.r) || 0), 0);
    return { t_min_c: round1(tmin), t_max_c: round1(tmax), rain_mm: round1(rsum) };
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
    arr.push({
      topic_tag: tipJson.topic_tag,
      plant_ids: tipJson.plant_ids || [],
      message_norm: (tipJson.message || "").toLowerCase().replace(/[^\w\s]/g, ""),
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

      // 3 - time and location block
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jerusalem";
      const isoDate = new Date().toISOString();
      const location_block = buildLocationBlock({ latitude, longitude, tz, isoDate });

      // 4 - derive compact weather summary + features for LLM
      const weather_summary = deriveDailyFromHourly(weatherRaw, isoDate);
      const weather_features = computeWeatherFeaturesFromSummary(weather_summary);

      // 5 - load plants before setSnapshot
      const plantsByArea = await loadGardenPlantsByArea();
      const flat = flattenPlants(plantsByArea);
      setSnapshot({ areas: plantsByArea, flat });

      // 6 - build compact LLM payload
      const compactPayload = stripNullsDeep({
        user_timezone: tz,
        calendar_today: isoDate,
        location_block,
        weather_summary,
        weather_features,
        plants: compactPlants(flat),
      });

      // 7 - fill debug panels
      setDebugPrompt({ system: systemMessage, developer: developerMessage, user: compactPayload });
      setDebugWeather({
        raw: weatherRaw,
        summary: weather_summary,
        features: weather_features
      });

      // 8 - ask the model
      const tip = await callTip(systemMessage, developerMessage, compactPayload);

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
  },  {
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
  },  {
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
  },  {
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
  },  {
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
  },  {
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
  },  {
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
      <Background/>
    <div style={{  overflowX: "hidden", overflowY: "auto" , position:"sticky"}}>
    <div >
      <TopBar/>
      <DailyTip 
        header="Thin seedlings" 
        subheader="Struggling = Too many seedlings too close together crowd each other out and compete for 
                        sunlight and nutrients. None of them grow well."
        content="Thriving = Each seedling has enough room. Seedlings grow quickly and get established. 
                      After planting seeds, thin them early and often. Young seedlings will grow and thrive 
                      when given enough room. Check mature spacing guidelines and square foot spacing in this blog post. "  
      />
     <SlideShow slidesComponents={slides} title="Recommended for you"/>
      {/* <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button
          className="my-garden-button"
          type="button"
          onClick={() => (window.location.href = "/MyGarden")}
        >
          Enter your gardens
        </button>

        <button
          type="button"
          onClick={buildAndSendGardenPlan}
          disabled={loading}
          title="Geolocate, fetch weather and your entire garden, then ask the AI for a care plan"
        >
          {loading ? "Working..." : "Get garden care plan"}
        </button>

      </div> */}

      {location && (
        <p style={{ marginTop: 8 }}>
          Latitude: {location.latitude}
          <br />
          Longitude: {location.longitude}
        </p>
      )}

      {error && (
        <p style={{ color: "red", marginTop: 8 }}>
          {error}
        </p>
      )}
      {/* debug need to remove */}
      {/* <div style={{ marginTop: 12 }}>
        <button type="button" onClick={() => setShowDebug(s => !s)}>
          {showDebug ? "Hide debug" : "Show debug"}
        </button>
      </div>

      {showDebug && (
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <h4 style={{ marginTop: 0 }}>Debug - outgoing prompt</h4>
          <details open>
            <summary><strong>System message</strong></summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{debugPrompt?.system || "(none)"}</pre>
          </details>
          <details>
            <summary><strong>Developer message</strong></summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{debugPrompt?.developer || "(none)"}</pre>
          </details>
          <details>
            <summary><strong>User JSON</strong></summary>
            <pre>{JSON.stringify(debugPrompt?.user ?? {}, null, 2)}</pre>
          </details>
          <h4>Debug - weather</h4>
          <details>
            <summary><strong>Weather raw</strong></summary>
            <pre>{JSON.stringify(debugWeather?.raw ?? {}, null, 2)}</pre>
          </details>
          <details>
            <summary><strong>Weather summary</strong></summary>
            <pre>{JSON.stringify(debugWeather?.summary ?? {}, null, 2)}</pre>
          </details>
          <details>
            <summary><strong>Weather features</strong></summary>
            <pre>{JSON.stringify(debugWeather?.features ?? {}, null, 2)}</pre>
          </details>

        </div>
      )} */}
      {/* Preview of what we sent for plants_by_area */}
      {snapshot.areas.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4>Your garden snapshot</h4>
          {snapshot.areas.map(a => (
            <div key={a.area_id} style={{ marginBottom: 8 }}>
              <strong>{a.area_name}</strong> ({a.plants.length} plants)
              <ul style={{ marginTop: 4 }}>
                {a.plants.map((p, i) => (
                  <li key={`${a.area_id}-${i}`}>
                    {p.plant_label} - bbox {p.bounding_box}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* AI output */}
      {ai.recommendations.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4>Daily tip</h4>
          {ai.recommendations.map((r, i) => (
            <div key={i}>
              <strong>{r.title}</strong>
              <p>{r.message}</p>
              <div style={{ fontSize: 12, color: "#666" }}>
                <span>Category: {r.category}</span>{' | '}
                <span>Topic: {r.topic_tag}</span>
              </div>
            </div>
          ))}
        </div>
      )}
  </div>    
</div></>);
}
export default Welcome;
