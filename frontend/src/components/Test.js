export default class Test {
    constructor(p, classifier) {
      this.p = p;
      this.classifier = classifier;
  
      this.testData = {};
      this.testLabels = [];
      this.currentLabelIndex = 0;
      this.testPhase = false;
    }
  
    beginTest() {
      this.testData = {};
      const userInput = prompt("Enter the labels you want to test, separated by commas:");
      if (userInput) {
        this.testLabels = userInput.split(",").map((label) => label.trim());
      }
      this.currentLabelIndex = 0;
      this.testPhase = false;
      this.askForImages();
    }
  
    askForImages() {
      if (this.currentLabelIndex >= this.testLabels.length) {
        this.testPhase = true;
        this.runTest();
        return;
      }
  
      const label = this.testLabels[this.currentLabelIndex];
      alert(`Please upload images for label: ${label}`);
  
      const input = this.p.createFileInput((file) => this.collectImages(file, label), true); 
      input.attribute("accept", "image/*");
      input.position(10, 70 + this.currentLabelIndex * 30);
    }
  
    collectImages(file, label) {
        if (!this.testData[label]) {
          this.testData[label] = [];
        }
      
        if (file && file.type === 'image') {

          this.p.loadImage(file.data, (img) => {
            this.testData[label].push(img);      
            if (this.testData[label].length >= 3) {
              this.currentLabelIndex++;
              this.askForImages();
            }
          });
        }
      }      
  
    runTest() {
      let correct = 0;
      let total = 0;
      for (let label in this.testData) {
        this.testData[label].forEach((img) => {
          this.classifier.classify(img, (result, error) => {
            if (!error && result[0].label === label) {
              correct++;
            }
            total++;
  
            const totalImages = Object.values(this.testData).flat().length;
            if (total === totalImages) {
              const accuracy = ((correct / total) * 100).toFixed(2);
              alert(`Test completed. Accuracy: ${accuracy}%`);
            }
          });
        });
      }
    }
  }
  