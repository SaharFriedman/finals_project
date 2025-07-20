export default class Test {
  constructor(p, classifier) {
    this.p = p;
    this.classifier = classifier;
    this.map = {};
    this.testData = {};
    this.testLabels = [];
    this.currentLabelIndex = 0;
    this.testPhase = false;
  }

  beginTest() {
    this.askForImages();
  }

  askForImages() {
    const input = this.p.createFileInput((file) => this.collectImages(file), true);
    input.attribute("accept", "image/*");
    input.position(10, 70 + this.currentLabelIndex * 30);
  }

  async collectImages(file) {
    if (file && file.type === 'image') {
      this.p.loadImage(file.data, async () => {
        const formData = new FormData();
        formData.append("image", file.file);

        const response = await fetch("http://127.0.0.1:2020/predict", {
          method: "POST",
          body: formData
        });
        const result = await response.json();
        const array = result.image;
        const coords = result.coords;
        // classify each base64 crop
        for (const item of array) {
          await new Promise((resolve) => {
            const coords = item.coords;  // this is [x1, y1, x2, y2]
            const b64 = item.image; 
            this.p.loadImage(`data:image/jpeg;base64,${b64}`, async (croppedImg) => {
              const label = await this.runTest(croppedImg);
              this.map[coords] = label;
              resolve();
              });
          });
        }
        return this.map;
      });
    }
  }

  runTest(image) {
    return new Promise((resolve, reject) => {
      this.classifier.classify(image, (results, error) => {
        if (error) reject(error);
        else resolve(results[0].label);
      });
    });
  }
}
