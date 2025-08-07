from ultralytics import YOLO
import cv2
# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
app = Flask(__name__)
CORS(app)
import base64
import cv2
import numpy as np
import weatherAPI as WAPI

def encode_image_to_base64(image_array):
    _, buffer = cv2.imencode('.jpg', image_array)
    encoded = base64.b64encode(buffer).decode('utf-8')
    return encoded

@app.route("/predict", methods=["POST"])
def predict():
    arr = []
    model_path = "my_model.pt"
    req = request.files["image"]
    file_bytes = np.frombuffer(req.read(), np.uint8)
    image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
    # Load the model into memory and get labemap
    model = YOLO(model_path, task='detect')
    results = model(image)[0]
    names = results.names
    for box in results.boxes:
        cls = int(box.cls[0])       # class id
        class_name = names[cls]
        if (class_name == "Plant" or class_name == "Flower"):
            conf = float(box.conf[0])       # confidence
            if (conf >= 0.56):    
                x1, y1, x2, y2 = map(int, box.xyxy[0])  # coordinates
                # Crop using coordinates
                crop = image[y1:y2, x1:x2]
                coords = list(map(int, box.xyxy[0]))
                arr.append({"coords": coords,"image": encode_image_to_base64(crop)})
    return jsonify({"image": arr})
@app.route("/weather", methods=["POST"])
def weather():
    data = request.get_json()  # parse JSON body
    lat = data.get("latitude")
    lon = data.get("longitude")
    weather_string = str(lat) + "," + str(lon)
    weatherJSON = WAPI.start(weather_string,0)
    return weatherJSON
if __name__ == "__main__":
    app.run(port=2020)
#=============================================================================#
# print(results[0].to_json())