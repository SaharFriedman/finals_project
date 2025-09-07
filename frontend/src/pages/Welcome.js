import SignOutButton from "../components/SignOutButton";
import { useState } from "react";
import axios from "axios";
import { authHeaders } from "../api/http";
import OPENAI_KEY from "../../src/components/apitok"
const API_BASE = "http://localhost:12345/api";


/** ====================== Utilities ====================== */
// checking the result of the weather forecast (google can change the output name)
function normalizeWeather(result) {
  if (!result) return null;
  if (result.daily_sun_data) return result.daily_sun_data;
  if (result.daily) return result.daily;
  if (result.forecast) return result.forecast;
  if (result.weather) return result.weather;
  return null;
}

// verifying plantDoc name until finalized project
function normalizePlantDoc(d) {
  // label
  const label =
    d?.label ??
    d?.plant_label ??
    d?.name ??
    d?.commonName ??
    d?.species ??
    "Plant";

  // try several coord shapes: coords, coordsPx, coords_px, bounding_box, x1..y2 until finished project
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

  return { plant_label: String(label), bounding_box: String(bbox) };
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
    const byIndex = ["0","1","2","3"].map(k => src[k]);
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
  try { return JSON.parse(s); } catch {}

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
    try { return JSON.parse(candidate); } catch {}
  }

  // As a last resort, walk left from the last '}' or ']'
  //    to recover a parseable prefix
  const lastClose = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  for (let i = lastClose; i >= start && i >= 0; i--) {
    const slice = s.slice(start, i + 1);
    try { return JSON.parse(slice); } catch {}
  }
  return null;
}

/** ====================== API wrappers ====================== */

// returns the list of all of the areas there are
async function listAreas() {
  const res = await fetch(`${API_BASE}/areas`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error(`listAreas failed: ${res.status}`);
  return res.json(); // expect something like [{ _id, name, ... }, ...]
}
// returns all of the plants that resides in this areaID
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

async function callOpenAI(jsonInput) {
  const apiKey = OPENAI_KEY;

  const systemMessage = `
You are a smart gardening assistant. Based on the weather forecast, sunlight data, and the user's garden layout, generate care instructions.

Input fields you may receive:
- weather: array of daily objects (for example, date, sunrise, sunset, daylight_duration,amount of rain)
- plants_by_area: array of { area_id, area_name, plants: [{ plant_label, bounding_box }] }
- location: { latitude: number, longitude: number }

If weather data is unavailable or marked {"unavailable": true}, infer conservative defaults and say the weather data was unavailable.

Return ONLY valid JSON with this exact schema (no extra text):
{
  "recommendations": [
    {
      "plant_label": "Rose",
      "bounding_box": "15,40,90,120",
      "area_id": "abc123",
      "area_name": "Front Bed",
      "water_liters_per_week": 4.5,
      "fertilizer_dates": ["2025-09-05", "2025-10-03"]
      "tip of the day": a short tip regarding an aspect of the garden that is not repetitive
    }
  ],
  "explanation": "One short paragraph explaining key decisions."
}
`.trim();

  const response = await axios.post(
    "https://api.together.xyz/v1/chat/completions",
    {
      model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: JSON.stringify(jsonInput, null, 2) },
      ],
      temperature: 0.4,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response;
}


/** ====================== main method ====================== */
const Welcome = () => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ai, setAi] = useState({ recommendations: [], explanation: "" });
  const [snapshot, setSnapshot] = useState({ areas: [], flat: [] });

  async function buildAndSendGardenPlan() {
    setError("");
    setLoading(true);
    // find users coordinations
    try {
      const coords = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
        navigator.geolocation.getCurrentPosition(
          pos => resolve(pos.coords),
          err => reject(new Error(`Geolocation error: ${err.message}`))
        );
      });
      const { latitude, longitude } = coords;
      setLocation({ latitude, longitude });
      // use the python server of googleAPI to get the weather data to the JS app 
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
      // return the raw weather with a flag if the normalization is a failure
      const weather = normalizeWeather(weatherRaw) ?? { unavailable: true, raw: weatherRaw };
      const plantsByArea = await loadGardenPlantsByArea();
      const flat = flattenPlants(plantsByArea);
      // creating this json by areas
      setSnapshot({ areas: plantsByArea, flat });

      // this is the chat Prompt, what will be sent to the API of LLM
      const chatPrompt = {
        weather,
        plants_by_area: plantsByArea,
        plants: flat,
        location: { latitude, longitude },
      };

      const answer = await callOpenAI(chatPrompt);
      // to remove
      console.log(answer);
      // to get the content w.o relying on the organization of the LLM JSON response
      const content = answer?.data?.choices?.[0]?.message?.content ?? "";
      const parsed = extractJsonFromText(content);

      // checking the response of the API properly
      if (!parsed) {
        console.warn("LLM did not return valid JSON. Raw:", content);
        setAi({ recommendations: [], explanation: "" });
        setError("The AI response was not valid JSON. Check console for details.");
        return;
      }
      // SAME HERE
      const recs = Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : parsed.recommendations
        ? [parsed.recommendations]
        : [];
      // making a map of the response devided by rec and exp
      setAi({
        recommendations: recs,
        explanation: parsed.explanation || "",
      });
    } catch (e) {
      console.error(e);
      setError(e.message || "Unknown error");
      setAi({ recommendations: [], explanation: "" });
    } finally {
      // finishing the wait for the
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h2>WelcomePage</h2>
      <h3>Welcome to the best website ever</h3>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
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

        <SignOutButton />
      </div>

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
          <h4>AI care plan</h4>
          <ul>
            {ai.recommendations.map((r, i) => (
              <li key={i}>
                <strong>{r.plant_label}</strong>
                {r.area_name ? ` in ${r.area_name}` : ""}
                {" - "}
                bbox {r.bounding_box}
                {typeof r.water_liters_per_week === "number" && (
                  <> • water: {r.water_liters_per_week} L/week</>
                )}
                {Array.isArray(r.fertilizer_dates) && r.fertilizer_dates.length > 0 && (
                  <> • fertilizer: {r.fertilizer_dates.join(", ")}</>
                )}
              </li>
            ))}
          </ul>
          {ai.explanation && <p><em>{ai.explanation}</em></p>}
        </div>
      )}
    </div>
  );
};

export default Welcome;
