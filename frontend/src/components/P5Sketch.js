/* global ml5 */
import React, { useEffect, useRef, useState } from "react";
import p5 from "p5";
import Test from "./Test";
import axios from "axios";

// ------------------------ Utilities ------------------------

function normalizeWeather(result) {
  if (!result) return null;
  if (result.daily_sun_data) return result.daily_sun_data;
  if (result.daily) return result.daily;
  if (result.forecast) return result.forecast;
  if (result.weather) return result.weather;
  return null;
}

function normalizePlants(mapObj) {
  // Converts {"x1,y1,x2,y2": "Label"} → [{ plant_label, bounding_box }]
  if (!mapObj || typeof mapObj !== "object") return [];
  return Object.entries(mapObj).map(([bbox, label]) => ({
    plant_label: String(label),
    bounding_box: String(bbox),
  }));
}

function extractJsonFromText(text) {
  if (!text || typeof text !== "string") return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fence ? fence[1] : text;

  const startObj = candidate.indexOf("{");
  const startArr = candidate.indexOf("[");
  const start =
    startObj === -1
      ? startArr
      : startArr === -1
      ? startObj
      : Math.min(startObj, startArr);
  const endObj = candidate.lastIndexOf("}");
  const endArr = candidate.lastIndexOf("]");
  const end = Math.max(endObj, endArr);

  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

// p5 factory so we can pass a ready-callback and get Test via ref
export const createSketch = (onReady, testRef) => (p) => {
  let classifier;

  p.setup = async () => {
    p.createCanvas(400, 400).parent("p5-container");

    classifier = await ml5.imageClassifier(
      "https://teachablemachine.withgoogle.com/models/l_4KoG78S/model.json"
    );

    testRef.current = new Test(p, classifier);

    const testButton = p.createButton("Start Test");
    testButton.position(10, 20);
    testButton.mousePressed(() => {
      if (testRef.current && typeof testRef.current.beginTest === "function") {
        testRef.current.beginTest();
      }
    });

    if (typeof onReady === "function") onReady();
  };
};

// ------------------------ Component ------------------------

const P5Sketch = () => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [p5Ready, setP5Ready] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ai, setAi] = useState({ recommendations: [], explanation: "" });

  const testRef = useRef(null);
  const p5InstanceRef = useRef(null);

  useEffect(() => {
    const mySketch = createSketch(() => setP5Ready(true), testRef);
    const myp5 = new p5(mySketch);
    p5InstanceRef.current = myp5;
    return () => {
      try {
        myp5.remove();
      } catch {}
      p5InstanceRef.current = null;
      setP5Ready(false);
      testRef.current = null;
    };
  }, []);

  // NOTE: move to your server in production; never ship your API key in the client.
  async function callOpenAI(jsonInput) {
    const apiKey = "c56ca245131b616981ea84923cca06342a12d2ff142475979ad57d0d09e485a6"; // ← replace & move server-side

    const systemMessage = `
You are a smart gardening assistant. Based on the weather forecast, sunlight data, and plant layout provided, generate care instructions for each plant.

Input fields you'll receive:
- weather: array of daily objects (e.g., date, sunrise, sunset, daylight_duration, etc.)
- plants: array of {"plant_label": string, "bounding_box": "x1,y1,x2,y2"}
- location: {"latitude": number, "longitude": number}

If weather data is unavailable or marked {"unavailable": true}, infer conservative defaults (avoid overwatering; suggest soil-moisture checks) and explicitly state that weather data was unavailable.

Return ONLY valid JSON with this exact schema (no extra text):
{
  "recommendations": [
    {
      "plant_label": "Flower",
      "bounding_box": "0,0,1920,1042",
      "water_liters_per_week": 4.5,
      "fertilizer_dates": ["2025-08-22", "2025-08-29"]
    }
  ],
  "explanation": "One short paragraph explaining key decisions."
}
`.trim();

    const userMessage = JSON.stringify(jsonInput, null, 2);

    const response = await axios.post(
      "https://api.together.xyz/v1/chat/completions",
      {
        model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
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

  const askForLocation = () => {
    setError(null);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    if (!p5Ready || !testRef.current) {
      setError("Canvas not ready yet. Please wait a moment.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setLoading(true);
        const { latitude, longitude } = position.coords;
        setLocation({ latitude, longitude });

        try {
          const response = await fetch("http://127.0.0.1:2020/weather", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude, longitude }),
          });

          if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Weather HTTP ${response.status} ${text}`);
          }

          let raw;
          try {
            raw = await response.json();
          } catch {
            throw new Error("Weather service returned invalid JSON.");
          }

          const weather = normalizeWeather(raw) ?? { unavailable: true, raw };
          const plants = normalizePlants(testRef.current?.map);

          const chatPrompt = {
            weather,
            plants,
            location: { latitude, longitude },
          };
          console.log("chatPrompt:", chatPrompt);

          const answer = await callOpenAI(chatPrompt);
          const content = answer?.data?.choices?.[0]?.message?.content ?? "";
          console.log("LLM raw content:", content);

          const parsed = extractJsonFromText(content);
          if (!parsed) {
            console.warn("LLM did not return valid JSON. Raw content:", content);
            setAi({ recommendations: [], explanation: "" });
          } else {
            const recs = Array.isArray(parsed.recommendations)
              ? parsed.recommendations
              : parsed.recommendations
              ? [parsed.recommendations]
              : [];
            setAi({ recommendations: recs, explanation: parsed.explanation || "" });
          }
        } catch (err) {
          console.error("Error fetching/processing weather or LLM:", err);
          setError(err.message || "Unknown error while fetching data.");
          setAi({ recommendations: [], explanation: "" });
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError(`Geolocation error: ${err.message}`);
      }
    );
  };

  return (
    <div>
      <div id="p5-container" />

      <button onClick={askForLocation} disabled={!p5Ready || loading}>
        {!p5Ready ? "Initializing…" : loading ? "Working…" : "Get My Location"}
      </button>

      {location && (
        <p>
          Latitude: {location.latitude}
          <br />
          Longitude: {location.longitude}
        </p>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}

      {ai.recommendations.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h4>AI Care Plan</h4>
          <ul>
            {ai.recommendations.map((r, i) => (
              <li key={i}>
                <strong>{r.plant_label}</strong> — bbox {r.bounding_box}
                {typeof r.water_liters_per_week === "number" && (
                  <> • water: {r.water_liters_per_week} L/week</>
                )}
                {Array.isArray(r.fertilizer_dates) &&
                  r.fertilizer_dates.length > 0 && (
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

export default P5Sketch;
