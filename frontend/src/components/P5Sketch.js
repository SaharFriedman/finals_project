/* global ml5 */
import React, { useEffect } from 'react';
import p5 from 'p5';
import Test from './Test';
let test;
let classifier;
let img;
let label = '';
let testData = {};
let testLabels = [];
let currentLabelIndex = 0;
let testPhase = false;


const P5Sketch = () => {
  useEffect(() => {
    let myp5 = new p5(sketch);
    return () => myp5.remove(); // Cleanup on unmount
  }, []);

  return <div id="p5-container"></div>;
};

export const sketch = (p) => {
  p.setup = () => {
    p.createCanvas(400, 400).parent('p5-container');

    classifier = ml5.imageClassifier(
      "https://teachablemachine.withgoogle.com/models/l_4KoG78S/model.json"
    );

    let testButton = p.createButton("Start Test");
    testButton.position(10, 20);
    testButton.mousePressed(() => test.beginTest());

    test = new Test(p, classifier); // pass classifier into Test

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
export default P5Sketch;
