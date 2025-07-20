/* global ml5 */
import React, { useEffect, useState } from "react";
import p5 from "p5";
import Test from "./Test";
import axios from "axios";
let test;
let classifier;
let img;
let label = "";

export const sketch = (p) => {
  p.setup = () => {
    p.createCanvas(400, 400).parent("p5-container");

    classifier = ml5.imageClassifier(
      "https://teachablemachine.withgoogle.com/models/l_4KoG78S/model.json"
    );

    let testButton = p.createButton("Start Test");
    testButton.position(10, 20);
    testButton.mousePressed(() => test.beginTest());

    test = new Test(p, classifier);
  };

  p.draw = () => {
    p.background(0);

    if (img) {
      p.image(img, 0, 0, p.width, p.height);
    }

    p.fill(255);
    p.textSize(32);
    p.textAlign(p.CENTER, p.CENTER);
    p.text(label, p.width / 2, p.height - 16);
  };
};

const P5Sketch = () => {
  // these belong inside the component
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const myp5 = new p5(sketch);
    return () => myp5.remove();
  }, []);

  async function callOpenAI(jsonInput) {
    const apiKey =
      "c56ca245131b616981ea84923cca06342a12d2ff142475979ad57d0d09e485a6";

    const systemMessage = 
     `You are a smart gardening assistant. Based on the weather forecast, sunlight data, and plant layout provided, generate care instructions for each plant.You must: 1. Consider each plant's type and position (bounding box) in the image. 2. Adjust recommendations for plants that may receive shade from nearby larger objects. 3. Use temperature, rainfall, and sunshine duration to decide how much water and whether fertilizer is needed.
      You must:
      1. Consider each plant's type and position (bounding box) in the image.
      2. Adjust recommendations for plants that may receive shade from nearby larger objects.
      3. Use temperature, rainfall, and sunshine duration to decide how much water and whether fertilizer is needed.
      Return the response *strictly in this JSON format*:
      json{
      "recommendations":
    {
      "plant_label": "Flower",
      "bounding_box": "0,0,1920,1042",
      "water_liters_per_week": 4.5,}"`.trim();

    const userMessage = 
     `${JSON.stringify(jsonInput, null, 2)}`.trim();

    const response = await axios.post("https://api.together.xyz/v1/chat/completions", {
       model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"}});
    return response;
  }

  const askForLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ latitude, longitude }); // update state

        try {
          const response = await fetch("http://127.0.0.1:2020/weather", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ latitude, longitude })
          });

          const result = await response.json();
          const chatPrompt = {
            weather: result.daily_sun_data,
            gardenObject: test.map
          };
          // optionally call OpenAI
          const answer = await callOpenAI(chatPrompt);
          const contentAnswer = answer.data.choices[0].message.content;
          const contentexplenation = answer.data.choices[0].message.explanation;
          console.log("content: ", contentAnswer);
          console.log("explenation:", contentexplenation);

        } catch (err) {
          console.error("Error sending location:", err);
        }
      },
      (err) => {
        setError(`Error: ${err.message}`);
      }
    );
  };

  return (
    <div>
      <div id="p5-container"></div>

      <button onClick={askForLocation}>Get My Location</button>

      {location && (
        <p>
          Latitude: {location.latitude}
          <br />
          Longitude: {location.longitude}
        </p>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
};

export default P5Sketch;
